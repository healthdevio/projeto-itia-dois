export interface ToolCallContext {
  conversation_id: string;
}

export interface ToolCall {
  id: string;
  tool_name: string;
  arguments: Record<string, unknown>;
  context: ToolCallContext;
}
