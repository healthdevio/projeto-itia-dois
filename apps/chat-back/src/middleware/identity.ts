import { createMiddleware } from 'hono/factory';
import { ApiResponse } from '../models/message.js';
export const USER_ID_HEADER = 'X-User-Id';
export const TENANT_ID_HEADER = 'X-Tenant-Id';
const MAX_USER_ID_LENGTH = 64;
const MAX_TENANT_ID_LENGTH = 64;
const USER_ID_PATTERN = /^[A-Za-z0-9._:|+@-]+$/;
const TENANT_ID_PATTERN = /^[A-Za-z0-9._-]+$/;
export type IdentityVariables = {
  userId: string;
  tenantId?: string;
};
export function validateUserId(
  value: string | undefined | null,
): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > MAX_USER_ID_LENGTH) return null;
  if (!USER_ID_PATTERN.test(trimmed)) return null;
  return trimmed;
}
export function validateTenantId(
  value: string | undefined | null,
): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > MAX_TENANT_ID_LENGTH) {
    return undefined;
  }
  return TENANT_ID_PATTERN.test(trimmed) ? trimmed : undefined;
}
export const identity = createMiddleware<{
  Variables: IdentityVariables;
}>(async (c, next) => {
  const userId = validateUserId(c.req.header(USER_ID_HEADER));
  if (!userId) {
    const response: ApiResponse = {
      success: false,
      error: `Header ${USER_ID_HEADER} ausente ou inválido`,
    };
    return c.json(response, 401);
  }
  c.set('userId', userId);
  const tenantId = validateTenantId(c.req.header(TENANT_ID_HEADER));
  if (tenantId !== undefined) {
    c.set('tenantId', tenantId);
  }
  await next();
});
