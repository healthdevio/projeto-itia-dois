import type { ChatContext } from '../../models/chat-context.js';
import type { PermissionCode } from '../../models/permission.js';
import type { Tool } from '../../models/tool.js';
import type { ToolCall } from '../../models/tool-call.js';

export type ToolAuthorizationResult =
  | { authorized: true }
  | { authorized: false; reason: 'tool_mismatch' }
  | {
      authorized: false;
      reason: 'missing_permissions';
      missing_permissions: PermissionCode[];
    };

export function authorizeToolCall(
  tool: Tool,
  toolCall: ToolCall,
  context: Pick<ChatContext, 'permissions'>,
): ToolAuthorizationResult {
  if (toolCall.tool_name !== tool.name) {
    return { authorized: false, reason: 'tool_mismatch' };
  }

  const grantedPermissions = new Set(context.permissions ?? []);
  const missingPermissions = tool.required_permissions.filter(
    (permission) => !grantedPermissions.has(permission),
  );

  if (missingPermissions.length > 0) {
    return {
      authorized: false,
      reason: 'missing_permissions',
      missing_permissions: missingPermissions,
    };
  }

  return { authorized: true };
}
