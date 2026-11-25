import { z } from 'zod';
import type { ConversationState } from './conversation-state.js';
import { chatConfigSchema, type ChatConfig } from './chat-config.js';
import { suggestionsListSchema, type Suggestion } from './suggestion.js';

export interface MessageStartedEvent {
  request_id: string;
  conversation_id: string;
  message_id: string;
  state: Extract<ConversationState, 'streaming'>;
}

export interface MessageDeltaEvent {
  request_id: string;
  conversation_id: string;
  message_id: string;
  delta: string;
}

export interface MessageCompletedEvent {
  request_id: string;
  conversation_id: string;
  message_id: string;
  state: Extract<ConversationState, 'success'>;
  suggestions: Suggestion[];
  config: ChatConfig;
}

export interface MessageErrorEvent {
  request_id: string;
  conversation_id: string;
  message_id: string;
  state: Extract<ConversationState, 'error'>;
  error: string;
}

export type SSEEvent =
  | {
      event: 'message.started';
      data: MessageStartedEvent;
    }
  | {
      event: 'message.delta';
      data: MessageDeltaEvent;
    }
  | {
      event: 'message.completed';
      data: MessageCompletedEvent;
    }
  | {
      event: 'message.error';
      data: MessageErrorEvent;
    };

const sseCorrelationSchema = z.object({
  request_id: z.string().trim().min(1, 'request_id é obrigatório'),
  conversation_id: z.string().trim().min(1, 'conversation_id é obrigatório'),
  message_id: z.string().trim().min(1, 'message_id é obrigatório'),
});

export const messageStartedEventSchema = sseCorrelationSchema.extend({
  state: z.literal('streaming'),
});

export const messageDeltaEventSchema = sseCorrelationSchema.extend({
  delta: z.string(),
});

export const messageCompletedEventSchema = sseCorrelationSchema.extend({
  state: z.literal('success'),
  suggestions: suggestionsListSchema,
  config: chatConfigSchema,
});

export const messageErrorEventSchema = sseCorrelationSchema.extend({
  state: z.literal('error'),
  error: z.string().trim().min(1, 'error é obrigatório'),
});

export const sseEventSchema = z.discriminatedUnion('event', [
  z.object({
    event: z.literal('message.started'),
    data: messageStartedEventSchema,
  }),
  z.object({
    event: z.literal('message.delta'),
    data: messageDeltaEventSchema,
  }),
  z.object({
    event: z.literal('message.completed'),
    data: messageCompletedEventSchema,
  }),
  z.object({
    event: z.literal('message.error'),
    data: messageErrorEventSchema,
  }),
]);
