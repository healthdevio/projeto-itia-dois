export type ConversationState = 'idle' | 'streaming' | 'success' | 'error';

export interface Suggestion {
  suggestion_id: string;
  text: string;
}

export interface Message {
  message_id: string;
  message: string;
  date?: string;
  metadata?: string;
  origin: string;
}

export interface ConversationMessage extends Message {
  role: 'user' | 'assistant';
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

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface SuggestionsData {
  suggestions: Suggestion[];
}
