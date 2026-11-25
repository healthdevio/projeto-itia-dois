import { z } from 'zod';
import { chatConfigInputSchema, type ChatConfigInput } from './chat-config.js';
import { messageSchema, type Message } from './message.js';

export interface ChatRequest extends Message {
  request_id: string;
  conversation_id?: string;
  config?: ChatConfigInput;
}

export const chatRequestSchema = messageSchema.extend({
  request_id: z.string().trim().min(1, 'request_id é obrigatório'),
  conversation_id: z
    .string()
    .trim()
    .min(1, 'conversation_id não pode ser vazio')
    .optional(),
  config: chatConfigInputSchema.optional(),
});
