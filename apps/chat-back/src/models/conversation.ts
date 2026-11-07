import type { Message } from './message.js';
import type { ConversationState } from './conversation-state.js';

export type { ConversationState } from './conversation-state.js';

export type MessageRole = 'user' | 'assistant';
export interface ConversationMessage extends Message {
  role: MessageRole;
}
export interface Conversation {
  id: string;
  state: ConversationState;
  messages: ConversationMessage[];
  created_at: string;
  updated_at: string;
}
export interface ConversationView {
  id: string;
  state: ConversationState;
  messages: ConversationMessage[];
  active_conversation: Conversation;
  history: Conversation[];
}
