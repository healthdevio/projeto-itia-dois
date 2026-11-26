import type { Conversation, Suggestion } from '../types/chat-contracts';

export interface ChatDataSource {
  getSuggestions(): Promise<Suggestion[]>;
  getHistory(): Promise<Conversation[]>;
}
