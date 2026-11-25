import { Injectable, OnModuleDestroy, Logger } from '@nestjs/common';
import type { ChatRequest } from '../../models/chat-request.js';
import type { ChatResponse } from '../../models/chat-response.js';
import type { ConversationState } from '../../models/conversation.js';
import type { SseChannel } from './broadcaster.js';
import { SseBroadcaster } from './broadcaster.js';
import { MessageProcessingService } from '../message-processing/index.js';
import { validateChatConfig } from '../../models/chat-config.js';
import {
  getOrCreateActiveConversation,
  transitionConversationState,
} from '../../repositories/conversation-repository.js';

/**
 * Eventos enviados pelo canal SSE do chat.
 *
 * Estes tipos de evento estão alinhados ao fluxo de processamento da Mia AI:
 * a conexão é aberta, a conversa transita para `streaming`, eventos
 * progressivos (delta de resposta) podem ser enviados, e a conexão se encerra
 * com um evento final contendo o `ChatResponse` completo.
 */
export type SseEventType =
  | 'connection.opened'
  | 'conversation.started'
  | 'conversation.state'
  | 'ai.delta'
  | 'ai.complete'
  | 'ai.error'
  | 'connection.closed';

export interface SseConnectionOpened {
  connectionId: string;
  conversationId: string;
}

export interface SseConversationStarted {
  conversationId: string;
  messageId: string;
}

export interface SseConversationState {
  conversationId: string;
  state: ConversationState;
}

export interface SseAiDelta {
  conversationId: string;
  messageId: string;
  delta: string;
}

export interface SseAiComplete {
  conversationId: string;
  response: ChatResponse;
}

export interface SseAiError {
  conversationId: string;
  error: string;
}

export interface SseConnectionClosed {
  connectionId: string;
  conversationId?: string;
}

/**
 * Gerencia conexões SSE ativas e envia eventos de streaming para o cliente.
 *
 * Cada conexão aberta fica registrada no `SseBroadcaster` sob um id gerado.
 * Serviços externos (ex.: processamento da Mia AI) podem escrever eventos em
 * uma conexão aberta chamando `writeEvent(connectionId, event)`.
 *
 * A integração com o processamento da Mia AI acontece por meio de
 * `streamMessage`, que recebe um `ChatRequest`, abre/retoma a conversa,
 * transita o estado para `streaming`, encaminha a mensagem à AI e escreve o
 * resultado de volta no canal SSE do cliente.
 */
@Injectable()
export class SseService implements OnModuleDestroy {
  private readonly logger = new Logger(SseService.name);

  constructor(
    private readonly broadcaster: SseBroadcaster,
    private readonly processing: MessageProcessingService,
  ) {}

  /**
   * Abre uma nova conexão SSE e retorna seu canal, já registrado.
   *
   * O canal deve ser mantido aberto pelo controller enquanto o cliente estiver
   * conectado. Quando o cliente desconectar, o canal é fechado automaticamente
   * e removido do broadcaster.
   */
  openConnection(channel: SseChannel): string {
    const connectionId = `sse-${crypto.randomUUID()}`;
    this.broadcaster.register(connectionId, channel);
    this.logger.debug(`Conexão SSE aberta: ${connectionId}`);

    // Notifica a abertura da conexão no próprio canal.
    channel.write({
      type: 'connection.opened',
      data: { connectionId } as SseConnectionOpened,
    });

    return connectionId;
  }

  /**
   * Encerra uma conexão SSE aberta, se existir.
   */
  closeConnection(connectionId: string): void {
    const channel = this.broadcaster.get(connectionId);
    if (!channel) return;
    channel.write({
      type: 'connection.closed',
      data: { connectionId } as SseConnectionClosed,
    });
    this.broadcaster.unregister(connectionId);
    this.logger.debug(`Conexão SSE encerrada: ${connectionId}`);
  }

  /**
   * Escreve um evento em uma conexão SSE aberta, se existir e estiver viva.
   *
   * Retorna true quando o evento foi escrito com sucesso. Retorna false se a
   * conexão não existe ou já foi encerrada.
   */
  writeEvent(
    connectionId: string,
    event: { type: SseEventType; data: unknown },
  ): boolean {
    const channel = this.broadcaster.get(connectionId);
    if (!channel || channel.abortSignal.aborted) return false;
    const ok = channel.write({ type: event.type, data: event.data });
    if (!ok) {
      this.broadcaster.unregister(connectionId);
    }
    return ok;
  }

  /**
   * Transita o estado da conversa e notifica o cliente pelo SSE.
   */
  async transitionState(
    userId: string,
    to: ConversationState,
    connectionId?: string,
  ): Promise<void> {
    await transitionConversationState(userId, to);
    if (connectionId) {
      const active = await this.getActiveConversation(userId);
      this.writeEvent(connectionId, {
        type: 'conversation.state',
        data: { conversationId: active.id, state: to } as SseConversationState,
      });
    }
  }

  /**
   * Processa uma mensagem de chat via SSE, enviando eventos progressivos ao
   * cliente e devolvendo o `ChatResponse` completo no evento final.
   *
   * Fluxo:
   * 1. Valida o `ChatRequest`.
   * 2. Abre (ou retoma) a conversa ativa do usuário.
   * 3. Transita para `streaming` e notifica o cliente.
   * 4. Encaminha a mensagem à Mia AI.
   * 5. Grava a resposta da AI e transita para `success`.
   * 6. Envia o evento `ai.complete` com o `ChatResponse` completo.
   *
   * Em caso de falha, transita para `error` e envia o evento `ai.error`.
   * Qualquer exceção inesperada resulta em 500 com evento de erro.
   */
  async streamMessage(
    userId: string,
    request: ChatRequest,
    connectionId: string,
  ): Promise<ChatResponse> {
    // Valida configuração antes de tocar no banco.
    const chatConfig = validateChatConfig(request.config);
    if (!chatConfig.ok) {
      this.writeEvent(connectionId, {
        type: 'ai.error',
        data: { error: chatConfig.error } as SseAiError,
      });
      throw new Error(chatConfig.error);
    }

    if (
      typeof request.message_id !== 'string' ||
      !request.message_id ||
      typeof request.message !== 'string' ||
      !request.message ||
      typeof request.origin !== 'string' ||
      !request.origin
    ) {
      this.writeEvent(connectionId, {
        type: 'ai.error',
        data: {
          error: 'Campos obrigatórios faltando: message_id, message, origin',
        } as SseAiError,
      });
      throw new Error(
        'Campos obrigatórios faltando: message_id, message, origin',
      );
    }

    let conversationId: string | undefined;
    try {
      const conversation = await getOrCreateActiveConversation(userId);
      conversationId = conversation.id;

      this.writeEvent(connectionId, {
        type: 'conversation.started',
        data: {
          conversationId,
          messageId: request.message_id,
        } as SseConversationStarted,
      });

      await this.transitionState(userId, 'streaming', connectionId);

      const result = await this.processing.processMessage(
        userId,
        request,
        undefined,
      );

      const response: ChatResponse = {
        request_id: request.request_id,
        conversation_id: result.conversation_id,
        message_id: result.message_id,
        ai_response: result.ai_response,
        state: result.state,
        suggestions: result.suggestions,
        config: result.config,
      };

      this.writeEvent(connectionId, {
        type: 'ai.complete',
        data: {
          conversationId: result.conversation_id,
          response,
        } as SseAiComplete,
      });

      return response;
    } catch (error) {
      try {
        if (conversationId) {
          await this.processing.transitionToError(userId);
          if (connectionId) {
            this.writeEvent(connectionId, {
              type: 'conversation.state',
              data: { conversationId, state: 'error' } as SseConversationState,
            });
          }
        }
      } catch {}
      const providerFailure =
        error instanceof Error && error.name === 'AIError';
      const messageError = providerFailure
        ? error.message
        : 'Erro interno ao processar mensagem via SSE';
      this.writeEvent(connectionId, {
        type: 'ai.error',
        data: { error: messageError } as SseAiError,
      });
      throw error;
    }
  }

  async onModuleDestroy(): Promise<void> {
    this.broadcaster.closeAll();
  }

  private async getActiveConversation(userId: string) {
    const { getOrCreateActiveConversation } =
      await import('../../repositories/conversation-repository.js');
    return getOrCreateActiveConversation(userId);
  }
}
