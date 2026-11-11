import type { ChatConfigInput } from './chat-config.js';
import type { Message } from './message.js';

export interface ChatRequest extends Message {
  config?: ChatConfigInput;
}
