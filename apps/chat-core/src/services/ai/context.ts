/**
 * Contexto da conversa repassado junto com a nova mensagem.
 *
 * É a fatia mínima do diálogo que a AI precisa para estar ciente do que já
 * foi falado — não a conversa inteira. Quem monta é o Core, porque quem tem o
 * estado é o Core.
 */

import type {
  ConversationMessage,
  ConversationState,
} from '../../models/conversation.js';

/**
 * Contexto da conversa que acompanha cada mensagem enviada à AI.
 */
export interface AIContext {
  /** Id da conversa em que a mensagem foi enviada. */
  conversation_id: string;

  /** Estado da conversa no momento do envio. */
  state: ConversationState;

  /** Mensagens anteriores da conversa, em ordem cronológica. */
  previous_messages: ConversationMessage[];

  /** Ids das conversas anteriores, mais recente primeiro. */
  history_ids: string[];

  /**
   * Quantas mensagens anteriores são enviadas por padrão. O histórico completo
   * pode estourar o contexto da janela da IA em conversas longas.
   */
  max_context_messages: number;
}

/** Quantas mensagens anteriores vão por padrão no contexto. */
export const DEFAULT_CONTEXT_WINDOW = 20;

/**
 * Monta o contexto a partir do estado atual da conversa.
 *
 * A mensagem atual **não** entra aqui: quem chama monta o contexto antes de
 * persistir, e é isso que impede a mensagem de aparecer como histórico de si
 * mesma.
 *
 * @param conversationId - Id da conversa ativa
 * @param state - Estado atual da máquina de estados
 * @param messages - Mensagens já persistidas na conversa ativa
 * @param historyIds - Ids das conversas anteriores, mais recente primeiro
 * @param maxContextMessages - Janela de contexto
 */
export function buildContext(
  conversationId: string,
  state: ConversationState,
  messages: ConversationMessage[],
  historyIds: string[],
  maxContextMessages = DEFAULT_CONTEXT_WINDOW,
): AIContext {
  return {
    conversation_id: conversationId,
    state,
    // As `maxContextMessages` mais recentes bastam: as mais antigas já
    // saíram da janela e são as menos relevantes para a resposta atual.
    previous_messages: messages.slice(-maxContextMessages),
    history_ids: historyIds,
    max_context_messages: maxContextMessages,
  };
}
