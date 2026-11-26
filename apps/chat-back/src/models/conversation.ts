import { z } from 'zod';
import { messageSchema, type Message } from './message.js';
import {
  conversationStateSchema,
  type ConversationState,
} from './conversation-state.js';

export { conversationStateSchema } from './conversation-state.js';
export type { ConversationState } from './conversation-state.js';

export const MESSAGE_ROLES = ['user', 'assistant'] as const;
export type MessageRole = (typeof MESSAGE_ROLES)[number];

export const messageRoleSchema = z.enum(MESSAGE_ROLES, {
  message: `role deve ser um de: ${MESSAGE_ROLES.join(', ')}`,
});

export interface ConversationMessage extends Message {
  role: MessageRole;
}

export const conversationMessageSchema = messageSchema.extend({
  role: messageRoleSchema,
});

export interface Conversation {
  id: string;
  state: ConversationState;
  messages: ConversationMessage[];
  created_at: string;
  updated_at: string;
}

export const conversationSchema = z.object({
  id: z.string().trim().min(1, 'id é obrigatório'),
  state: conversationStateSchema,
  messages: z.array(conversationMessageSchema),
  created_at: z.string().trim().min(1, 'created_at é obrigatório'),
  updated_at: z.string().trim().min(1, 'updated_at é obrigatório'),
});

export interface ConversationView {
  id: string;
  state: ConversationState;
  messages: ConversationMessage[];
  active_conversation: Conversation;
  history: Conversation[];
}

export const conversationViewSchema = z.object({
  id: z.string().trim().min(1, 'id é obrigatório'),
  state: conversationStateSchema,
  messages: z.array(conversationMessageSchema),
  active_conversation: conversationSchema,
  history: z.array(conversationSchema),
});
