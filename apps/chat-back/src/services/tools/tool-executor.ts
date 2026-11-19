import type { ChatContext } from '../../models/chat-context.js';
import type { PermissionCode } from '../../models/permission.js';
import type { Tool } from '../../models/tool.js';
import type { ToolCall } from '../../models/tool-call.js';
import { authorizeToolCall } from './tool-authorization.js';
import {
  validateToolArguments,
  type ToolArgumentsValidation,
} from './tool-arguments-validator.js';

export type ToolExecutor<TOutput = unknown> = (
  toolCall: ToolCall,
) => TOutput | Promise<TOutput>;

export type ToolExecutionResult<TOutput = unknown> =
  | { success: true; output: TOutput }
  | {
      success: false;
      error: 'UNAUTHORIZED';
      missing: PermissionCode[];
      reason?: 'tool_mismatch';
    }
  | {
      success: false;
      error: 'INVALID_ARGUMENTS';
      errors: Extract<ToolArgumentsValidation, { valid: false }>['errors'];
    }
  | { success: false; error: 'EXECUTION_ERROR'; reason: string };

export async function executeToolCall<TOutput>(
  tool: Tool,
  toolCall: ToolCall,
  context: Pick<ChatContext, 'permissions'>,
  executor: ToolExecutor<TOutput>,
): Promise<ToolExecutionResult<TOutput>> {
  const authorization = authorizeToolCall(tool, toolCall, context);

  if (!authorization.authorized) {
    if (authorization.reason === 'tool_mismatch') {
      return {
        success: false,
        error: 'UNAUTHORIZED',
        missing: [],
        reason: 'tool_mismatch',
      };
    }

    return {
      success: false,
      error: 'UNAUTHORIZED',
      missing: authorization.missing_permissions,
    };
  }

  const validation = validateToolArguments(tool, toolCall.arguments);
  if (!validation.valid) {
    return {
      success: false,
      error: 'INVALID_ARGUMENTS',
      errors: validation.errors,
    };
  }

  try {
    const output = await executor(toolCall);
    return { success: true, output };
  } catch (error) {
    return {
      success: false,
      error: 'EXECUTION_ERROR',
      reason: error instanceof Error ? error.message : String(error),
    };
  }
}
