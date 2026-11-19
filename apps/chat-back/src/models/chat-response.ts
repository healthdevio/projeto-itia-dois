import type { ChatConfig } from './chat-config.js';
import type { ConversationState } from './conversation.js';
import type { Suggestion } from './suggestion.js';

export interface ChatResponse {
  request_id: string;
  conversation_id: string;
  message_id: string;
  ai_response: string;
  state: ConversationState;
  suggestions: Suggestion[];
  config: ChatConfig;
}
