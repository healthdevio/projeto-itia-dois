import { z } from 'zod';
import {
  chatConfigInputSchema,
  DEFAULT_CHAT_CONFIG,
  type ChatConfig,
  type ChatConfigInput,
} from './chat-config.js';
import {
  validateContract,
  type ContractValidationIssue,
} from './contract-validation.js';
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

export type ValidatedChatRequest = Omit<ChatRequest, 'config'> & {
  config: ChatConfig;
};

export type ValidateChatRequestResult =
  | { ok: true; data: ValidatedChatRequest }
  | { ok: false; error: string; issues: ContractValidationIssue[] };

function sanitizeForLog(value: string): string {
  return value.replace(/[\u0000-\u001F\u007F]+/g, ' ').trim();
}

export function validateChatRequest(value: unknown): ValidateChatRequestResult {
  const result = validateContract(chatRequestSchema, value, 'ChatRequest');
  if (!result.ok) {
    return result;
  }

  const parsed = result.data as unknown as ChatRequest;
  const normalizedConfig: ChatConfig = {
    ...DEFAULT_CHAT_CONFIG,
    ...parsed.config,
  };

  return {
    ok: true,
    data: {
      ...parsed,
      message_id: sanitizeForLog(parsed.message_id),
      request_id: sanitizeForLog(parsed.request_id),
      conversation_id: parsed.conversation_id
        ? sanitizeForLog(parsed.conversation_id)
        : undefined,
      config: normalizedConfig,
    },
  };
}
