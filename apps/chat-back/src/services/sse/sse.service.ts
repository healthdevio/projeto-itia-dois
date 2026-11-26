import { Injectable, OnModuleDestroy, Logger } from '@nestjs/common';
import type { ChatRequest } from '../../models/chat-request.js';
import type { ChatResponse } from '../../models/chat-response.js';
import type { ConversationState } from '../../models/conversation.js';
import type { SseChannel } from './broadcaster.js';
import { SseBroadcaster } from './broadcaster.js';
import { MessageProcessingService } from '../message-processing/index.js';
import { transitionConversationState } from '../../repositories/conversation-repository.js';

export type SseEventType =
  | 'connection.opened'
  | 'message.started'
  | 'message.delta'
  | 'message.completed'
  | 'message.error'
  | 'connection.closed'
  | 'conversation.state';

export interface SseConnectionOpened {
  connectionId: string;
}

export interface SseConnectionClosed {
  connectionId: string;
}

type OwnerError = {
  code: 'CONNECTION_NOT_FOUND';
} | {
  code: 'CONNECTION_CLOSED';
} | {
  code: 'CONNECTION_NOT_OWNER';
};

type GetConversationId = (userId: string) => Promise<string>;

export interface MessageStartedEvent {
  request_id: string;
  conversation_id: string;
  message_id: string;
  state: Extract<ConversationState, 'streaming'>;
}

export interface MessageDeltaEvent {
  request_id: string;
  conversation_id: string;
  message_id: string;
  delta: string;
}

export interface MessageCompletedEvent {
  request_id: string;
  conversation_id: string;
  message_id: string;
  state: Extract<ConversationState, 'success'>;
  suggestions: import('../../models/suggestion.js').Suggestion[];
  config: import('../../models/chat-config.js').ChatConfig;
}

export interface MessageErrorEvent {
  request_id: string;
  conversation_id: string;
  message_id: string;
  state: Extract<ConversationState, 'error'>;
  error: string;
}

/**
 * Gerencia conexões SSE ativas e envia eventos de streaming para o cliente.
 *
 * Cada conexão aberta fica registrada no `SseBroadcaster` sob um id gerado
 * e associada ao `userId` do proprietário autenticado. O isolamento entre
 * conexões é garantido pelo fato de cada canal escrever apenas para o seu
 * próprio cliente, e pela validação de propriedade em `assertOwner`.
 *
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
  private readonly owners = new Map<string, string>(); // connectionId -> userId
  private getConversationId?: GetConversationId;

  constructor(
    private readonly broadcaster: SseBroadcaster,
    private readonly processing: MessageProcessingService,
  ) {}

  /**
   * Injetar (ou sobrescrever em testes) a função de resolução do conversation_id.
   */
  setGetConversationId(fn: GetConversationId): void {
    this.getConversationId = fn;
  }

  /**
   * Abre uma nova conexão SSE e retorna seu canal, já registrado.
   *
   * O canal deve ser mantido aberto pelo controller enquanto o cliente estiver
   * conectado. Quando o cliente desconectar, o canal é fechado automaticamente
   * e removido do broadcaster.
   */
  openConnection(channel: SseChannel, userId: string): string {
    const connectionId = `sse-${crypto.randomUUID()}`;
    this.broadcaster.register(connectionId, channel);
    channel.setOwner(userId);
    this.owners.set(connectionId, userId);
    this.logger.debug(`Conexão SSE aberta: ${connectionId} (usuário ${userId})`);

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
    channel.close();
    this.broadcaster.unregister(connectionId);
    this.owners.delete(connectionId);
    this.logger.debug(`Conexão SSE encerrada: ${connectionId}`);
  }

  /**
   * Valida o proprietário de uma conexão.
   * Lança um erro tipado quando a conexão não existe, está encerrada ou não
   * pertence ao usuário solicitante.
   */
  private assertOwner(
    connectionId: string,
    userId: string,
  ): { ok: true; channel: SseChannel } | { ok: false; error: OwnerError } {
    const channel = this.broadcaster.get(connectionId);
    if (!channel) {
      return { ok: false, error: { code: 'CONNECTION_NOT_FOUND' } };
    }
    const owner = this.owners.get(connectionId) ?? channel.ownerId;
    if (!owner || owner !== userId) {
      return { ok: false, error: { code: 'CONNECTION_NOT_OWNER' } };
    }
    if (channel.abortSignal.aborted) {
      return { ok: false, error: { code: 'CONNECTION_CLOSED' } };
    }
    return { ok: true, channel };
  }

  /**
   * Escreve um evento em uma conexão SSE aberta, se existir e estiver viva.
   *
   * Retorna true quando o evento foi escrito com sucesso. Retorna false se a
   * conexão não existe ou já foi encerrada.
   */
  writeEvent(
    connectionId: string,
    userId: string,
    event: { type: SseEventType; data: unknown },
  ): boolean {
    const validation = this.assertOwner(connectionId, userId);
    if (!validation.ok) {
      return false;
    }
    const { channel } = validation;
    const ok = channel.write({ type: event.type, data: event.data });
    if (!ok) {
      this.broadcaster.unregister(connectionId);
      this.owners.delete(connectionId);
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
      this.writeEvent(connectionId, userId, {
        type: 'conversation.state',
        data: { conversationId: active.id, state: to },
      });
    }
  }

  /**
   * Processa uma mensagem de chat via SSE, enviando eventos progressivos ao
   * cliente e devolvendo o `ChatResponse` completo no evento final.
   *
   * Fluxo:
   * 1. Valida o `ChatRequest` e a propriedade da conexão.
   * 2. Abre (ou retoma) a conversa ativa do usuário.
   * 3. Emite `message.started` com o `conversation_id` real.
   * 4. Encaminha a mensagem à IA via `MessageProcessingService`, com `onDelta`
   *    para transmissão incremental e `signal` para cancelamento.
   * 5. Emite `message.completed` com o `ChatResponse` completo.
   *
   * Em caso de falha ou cancelamento, transita para `error` sem persistir
   * resposta incompleta como concluída.
   */
  async streamMessage(
    userId: string,
    request: ChatRequest,
    connectionId: string,
  ): Promise<ChatResponse> {
    const validation = this.assertOwner(connectionId, userId);
    if (!validation.ok) {
      const error = new Error(
        validation.error.code === 'CONNECTION_NOT_FOUND'
          ? 'Conexão SSE não encontrada'
          : validation.error.code === 'CONNECTION_NOT_OWNER'
            ? 'Conexão SSE não pertence a este usuário'
            : 'Conexão SSE encerrada',
      );
      (error as { code?: string }).code = validation.error.code;
      throw error;
    }
    const { channel } = validation;
    const signal = channel.abortSignal;

    // Obtém o conversation_id real ANTES de emitir o evento started.
    let conversationId: string;
    try {
      conversationId = await this.resolveConversationId(userId);
    } catch (error) {
      const providerFailure = error instanceof Error && error.name === 'AIError';
      this.writeEvent(connectionId, userId, {
        type: 'message.error',
        data: {
          request_id: request.request_id,
          conversation_id: '',
          message_id: request.message_id,
          state: 'error',
          error: providerFailure
            ? error.message
            : 'Erro ao recuperar conversa ativa',
        },
      });
      throw error;
    }

    this.writeEvent(connectionId, userId, {
      type: 'message.started',
      data: {
        request_id: request.request_id,
        conversation_id: conversationId,
        message_id: request.message_id,
        state: 'streaming',
      },
    });

    let fullResponse = '';
    let suggestions: ChatResponse['suggestions'] = [];
    let config: ChatResponse['config'];

    try {
      const response = await this.processing.processMessage(
        userId,
        request,
        undefined,
        // onDelta: acumula o conteúdo completo e emite eventos delta para a conexão.
        (delta: string) => {
          fullResponse += delta;
          this.writeEvent(connectionId, userId, {
            type: 'message.delta',
            data: {
              request_id: request.request_id,
              conversation_id: conversationId,
              message_id: request.message_id,
              delta,
            },
          });
        },
        signal,
      );

      // Quando onDelta não é usado (provedor sem streaming), usamos o resultado direto.
      fullResponse = response.ai_response || fullResponse;
      suggestions = response.suggestions;
      config = response.config;

      if (signal.aborted) {
        const error = new Error('Operação cancelada pelo cliente');
        error.name = 'AbortError';
        throw error;
      }

      this.writeEvent(connectionId, userId, {
        type: 'message.completed',
        data: {
          request_id: response.request_id,
          conversation_id: response.conversation_id,
          message_id: response.message_id,
          state: response.state,
          suggestions,
          config,
        },
      });

      return response;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        // Não persiste resposta incompleta como concluída.
        // Não transmite eventos após o encerramento (writeEvent já retornará false).
        this.logger.debug(
          `Processamento cancelado para conexão ${connectionId} (usuário ${userId})`,
        );
        try {
          await transitionConversationState(userId, 'error');
        } catch {
          // Estado já pode estar em error; não propaga.
        }
        throw error;
      }

      const providerFailure = error instanceof Error && error.name === 'AIError';
      const messageError = providerFailure
        ? error.message
        : 'Erro interno ao processar mensagem via SSE';

      this.writeEvent(connectionId, userId, {
        type: 'message.error',
        data: {
          request_id: request.request_id,
          conversation_id: conversationId,
          message_id: request.message_id,
          state: 'error',
          error: messageError,
        },
      });

      try {
        await this.processing.transitionToError(userId);
      } catch {
        // Estado já pode estar em error; não propaga.
      }
      throw error;
    }
  }

  /**
   * Obtém o identificador real da conversa ativa antes de iniciar o processamento.
   * Usa a função injetada (produção ou teste) ou um fallback padrão no banco.
   */
  private async resolveConversationId(userId: string): Promise<string> {
    if (this.getConversationId) {
      return this.getConversationId(userId);
    }
    // Fallback para uso direto fora de testes: busca no banco de dados.
    const { getOrCreateActiveConversation } = await import(
      '../../repositories/conversation-repository.js'
    );
    const conversation = await getOrCreateActiveConversation(userId);
    return conversation.id;
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
