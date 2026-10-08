import type {
  ConversationMessage,
  ConversationState,
} from '../../models/conversation.js';
export interface AIContext {
  conversation_id: string;
  state: ConversationState;
  previous_messages: ConversationMessage[];
  history_ids: string[];
  max_context_messages: number;
}
export const DEFAULT_CONTEXT_WINDOW = 20;
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
    previous_messages: messages.slice(-maxContextMessages),
    // Cópia: o contexto é entregue ao provider e registrado no log.
    history_ids: [...historyIds],
    max_context_messages: maxContextMessages,
  };
}
