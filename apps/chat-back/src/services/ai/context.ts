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
  relevant_memories?: RelevantMemory[];
}
export interface RelevantMemory {
  id: string;
  content: string;
  category: string;
  importance: number;
  context: string | null;
  updatedAt: string;
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
