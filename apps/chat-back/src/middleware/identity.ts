import { createRemoteJWKSet, jwtVerify } from 'jose';
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

let jwksUrl: string | undefined;
let jwks: ReturnType<typeof createRemoteJWKSet> | undefined;

export function validateUserId(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > MAX_USER_ID_LENGTH) return null;
  if (!USER_ID_PATTERN.test(trimmed)) return null;
  return trimmed;
}

export function validateTenantId(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > MAX_TENANT_ID_LENGTH) {
    return undefined;
  }
  return TENANT_ID_PATTERN.test(trimmed) ? trimmed : undefined;
}

function getJwks() {
  const configuredUrl = process.env.OIDC_JWKS_URL?.trim();
  if (!configuredUrl) throw new Error('OIDC_JWKS_URL is not configured');

  if (configuredUrl !== jwksUrl) {
    const url = new URL(configuredUrl);
    if (url.protocol !== 'https:' && process.env.NODE_ENV === 'production') {
      throw new Error('OIDC_JWKS_URL must use HTTPS in production');
    }
    jwksUrl = configuredUrl;
    jwks = createRemoteJWKSet(url);
  }
  return jwks!;
}

export const identity = createMiddleware<{
  Variables: IdentityVariables;
}>(async (c, next) => {
  const issuer = process.env.OIDC_ISSUER?.trim();
  const audience = process.env.OIDC_AUDIENCE?.trim();
  const authorization = c.req.header('Authorization');
  const bearer = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];

  if (!issuer || !audience || !bearer) {
    const response: ApiResponse = {
      success: false,
      error: 'Autenticação Bearer ausente ou configuração OIDC incompleta',
    };
    return c.json(response, 401);
  }

  if (process.env.NODE_ENV === 'production') {
    try {
      if (new URL(issuer).protocol !== 'https:') {
        throw new Error('OIDC_ISSUER must use HTTPS in production');
      }
    } catch {
      const response: ApiResponse = {
        success: false,
        error: 'Configuração OIDC inválida',
      };
      return c.json(response, 401);
    }
  }

  let userId: string | null = null;
  let tenantId: string | undefined;
  try {
    const { payload } = await jwtVerify(bearer, getJwks(), {
      issuer,
      audience,
      algorithms: ['RS256', 'ES256'],
    });
    userId = validateUserId(payload.sub);
    if (!userId || typeof payload.exp !== 'number') {
      throw new Error('Token subject or expiration is missing or invalid');
    }
    const tenantClaim = process.env.OIDC_TENANT_CLAIM?.trim() || 'tenant_id';
    tenantId = validateTenantId(payload[tenantClaim]);
  } catch {
    const response: ApiResponse = {
      success: false,
      error: 'Token de acesso inválido',
    };
    return c.json(response, 401);
  }

  c.set('userId', userId);
  if (tenantId) c.set('tenantId', tenantId);
  await next();
});
