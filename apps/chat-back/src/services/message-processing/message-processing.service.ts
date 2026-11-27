import { Injectable } from '@nestjs/common';
import type { ChatConfig } from '../../models/chat-config.js';
import type { ChatRequest } from '../../models/chat-request.js';
import type { ConversationState } from '../../models/conversation.js';
import type { Message } from '../../models/message.js';
import type { Suggestion } from '../../models/suggestion.js';
import { validateChatConfig } from '../../models/chat-config.js';
import {
  appendMessage,
  getHistoryIds,
  getOrCreateActiveConversation,
  transitionConversationState,
} from '../../repositories/conversation-repository.js';
import {
  getActiveSuggestions,
  replaceActiveSuggestions,
} from '../../repositories/suggestion-repository.js';
import {
  AIError,
  avaliarEAtualizarMemoria,
  buildContext,
  injetarMemoriasNoContexto,
  recuperarMemoriaRelevante,
  sendToAI,
  withHostContext,
} from '../ai/index.js';
import { isHostContextEnabled } from '../host/host-context.config.js';
import { HostContextService } from '../host/host-context.service.js';
import { registrarMensagemRecebida } from '../../utils/message-log.js';

type OnDelta = (delta: string) => void;

/**
 * Resultado centralizado do processamento de uma mensagem de chat.
 *
 * Tanto o fluxo HTTP (`MessagesController`) quanto o fluxo SSE (`SseService`)
 * consomem esse resultado, evitando duplicação da lógica de processamento.
 */
export interface MessageProcessingResult {
  message_id: string;
  request_id: string;
  ai_response: string;
  state: ConversationState;
  suggestions: Suggestion[];
  config: ChatConfig;
  conversation_id: string;
}

/**
 * Serviço centralizado de processamento de mensagens de chat.
 *
 * Responsabilidades:
 * - recuperar memórias relevantes do usuário (I.A [10]);
 * - recuperar ou criar a conversa ativa do usuário;
 * - montar o contexto enviado à IA, incluindo memórias;
 * - persistir a mensagem do usuário e a resposta da IA;
 * - controlar os estados da conversa;
 * - resolver as sugestões da conversa;
 * - avaliar e atualizar memória permanente após a resposta (I.A [11]).
 * - transmitir deltas incrementais da resposta da IA (quando fornecido `onDelta`);
 * - suportar cancelamento via `AbortSignal`.
 *
 * Não lida com transporte (HTTP nem SSE): apenas com a lógica de processamento.
 * Os componentes de transporte (`MessagesController`, `SseService`) ficam
 * responsáveis por expor esse processamento nos seus respectivos canais.
 */
@Injectable()
export class MessageProcessingService {
  constructor(private readonly hostContext: HostContextService) {}

  /**
   * Verifica se o sinal de abort foi acionado. Lança um `AbortError` quando
   * o processamento deve ser cancelado (cliente desconectado).
   */
  private throwIfAborted(signal: AbortSignal | undefined): void {
    if (signal?.aborted) {
      const error = new Error('Operação cancelada pelo cliente');
      error.name = 'AbortError';
      throw error;
    }
  }

  /**
   * Processa uma mensagem de chat do ponto de vista da persistência e da IA.
   *
   * Pressupõe que `request` já foi validado (config e campos obrigatórios)
   * pelo componente de transporte que chamou este serviço.
   *
   * @param userId identificador do usuário autenticado (isolamento obrigatório)
   * @param request dados da requisição de chat já validados
   * @param tenant tenant opcional para seleção de prompt
   * @param onDelta callback opcional para deltas incrementais da resposta da IA
   * @param signal sinal de abort para cancelamento na desconexão do cliente
   * @returns resultado estruturado com resposta da IA, estado e sugestões
   */
  async processMessage(
    userId: string,
    request: ChatRequest,
    tenant?: string,
    onDelta?: OnDelta,
    signal?: AbortSignal,
  ): Promise<MessageProcessingResult> {
    const chatConfig = this.resolveConfig(request.config);

    this.throwIfAborted(signal);

    const message: Message = {
      message_id: request.message_id,
      message: request.message,
      metadata: request.metadata,
      origin: request.origin,
      date: request.date || new Date().toISOString(),
    };

    registrarMensagemRecebida({
      origin: message.origin,
      userId,
      messageId: message.message_id,
      language: chatConfig.language,
      tone: chatConfig.tone,
      responseLength: chatConfig.response_length,
    });

    const conversation = await getOrCreateActiveConversation(userId);

    this.throwIfAborted(signal);

    // O contexto do Host é carregado antes de gravar a mensagem: uma falha
    // explícita não pode ser substituída por um contexto vazio.
    const hostContext = isHostContextEnabled()
      ? await this.hostContext.load(
          { userId, tenantId: tenant },
          conversation.id,
        )
      : undefined;

    this.throwIfAborted(signal);

    // I.A [10] — Recuperar memória relevante antes de montar o contexto da IA.
    const memórias = await recuperarMemoriaRelevante(userId, request.message);

    const contextoBase = withHostContext(
      buildContext(
        conversation.id,
        conversation.state,
        conversation.messages,
        await getHistoryIds(userId),
      ),
      hostContext?.chat_context,
    );
    const contextoComMemoria = injetarMemoriasNoContexto(
      contextoBase,
      memórias,
    );

    await appendMessage(message, 'user', conversation.id);
    await transitionConversationState(userId, 'streaming');

    const aiResponse = await sendToAI({
      message,
      context: contextoComMemoria,
      config: chatConfig,
      tenant,
      onDelta,
      signal,
    });

    this.throwIfAborted(signal);

    const aiMessage: Message = {
      message_id: `${message.message_id}-ai`,
      message: aiResponse.response,
      date: new Date().toISOString(),
      origin: 'ai',
    };
    await appendMessage(aiMessage, 'assistant', conversation.id);

    const suggestions =
      aiResponse.suggestions === null
        ? await getActiveSuggestions(userId)
        : await replaceActiveSuggestions(userId, aiResponse.suggestions);

    await transitionConversationState(userId, 'success');

    // I.A [11] — Avaliar e atualizar memória permanente após a resposta da IA.
    await avaliarEAtualizarMemoria(
      userId,
      request.message,
      aiResponse.response,
      contextoComMemoria,
      chatConfig,
      tenant,
    );

    return {
      message_id: message.message_id,
      request_id: request.request_id,
      ai_response: aiResponse.response,
      state: 'success',
      suggestions,
      config: chatConfig,
      conversation_id: conversation.id,
    };
  }

  /**
   * Transita a conversa para o estado de erro.
   * Não lança exceção: usado para tratamento centralizado de falhas.
   */
  async transitionToError(userId: string): Promise<void> {
    await transitionConversationState(userId, 'error').catch(() => {
      // Estado já pode estar em error; não propaga.
    });
  }

  private resolveConfig(config: unknown): ChatConfig {
    const validation = validateChatConfig(config);
    if (!validation.ok) {
      throw new AIError(validation.error);
    }
    return validation.config;
  }
}
