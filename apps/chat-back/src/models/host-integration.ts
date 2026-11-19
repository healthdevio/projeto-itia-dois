import type { ChatContext } from './chat-context.js';
import type { Tool } from './tool.js';
import type { ToolCall } from './tool-call.js';

export interface HostPrincipal {
  user_id: string;
  tenant_id?: string;
}

export interface HostContextRequest {
  principal: HostPrincipal;
  conversation_id: string;
}

export interface HostConversationContext {
  chat_context: ChatContext;
  tools: Tool[];
}

export interface HostToolExecutionRequest {
  principal: HostPrincipal;
  tool_call: ToolCall;
}

export type HostToolOutput =
  | string
  | number
  | boolean
  | null
  | HostToolOutput[]
  | { [key: string]: HostToolOutput };

export interface HostIntegration {
  loadConversationContext(
    request: HostContextRequest,
  ): Promise<HostConversationContext>;
  executeTool(request: HostToolExecutionRequest): Promise<HostToolOutput>;
}
