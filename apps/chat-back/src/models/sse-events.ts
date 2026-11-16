import type { ConversationState } from './conversation-state.js';
import type { ChatConfig } from './chat-config.js';
import type { Suggestion } from './suggestion.js';

export interface MessageStartedEvent {
  message_id: string;
  state: Extract<ConversationState, 'streaming'>;
}

export interface MessageDeltaEvent {
  message_id: string;
  delta: string;
}

export interface MessageCompletedEvent {
  message_id: string;
  state: Extract<ConversationState, 'success'>;
  suggestions: Suggestion[];
  config: ChatConfig;
}

export interface MessageErrorEvent {
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
