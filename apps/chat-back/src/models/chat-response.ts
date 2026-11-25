import { z } from 'zod';
import { chatConfigSchema, type ChatConfig } from './chat-config.js';
import {
  conversationStateSchema,
  type ConversationState,
} from './conversation.js';
import { suggestionsListSchema, type Suggestion } from './suggestion.js';

export interface ChatResponse {
  request_id: string;
  conversation_id: string;
  message_id: string;
  ai_response: string;
  state: ConversationState;
  suggestions: Suggestion[];
  config: ChatConfig;
}

export const chatResponseSchema = z.object({
  request_id: z.string().trim().min(1, 'request_id é obrigatório'),
  conversation_id: z.string().trim().min(1, 'conversation_id é obrigatório'),
  message_id: z.string().trim().min(1, 'message_id é obrigatório'),
  ai_response: z.string(),
  state: conversationStateSchema,
  suggestions: suggestionsListSchema,
  config: chatConfigSchema,
});
