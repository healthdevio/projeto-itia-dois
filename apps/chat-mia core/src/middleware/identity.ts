/**
 * Identity Middleware
 *
 * Resolve a identidade do usuário a partir da requisição e a anexa ao
 * contexto do Hono. Todos os endpoints de conversa e de mensagem dependem
 * dele: sem identidade, não há conversa — a resposta é 401.
 *
 * ## Isto não é autenticação
 *
 * O Core confia no valor cru de `X-User-Id`. **Qualquer cliente pode enviar
 * o header que quiser e impersonar qualquer outro usuário.** O que existe
 * aqui é uma fronteira de identidade, não uma barreira de segurança.
 *
 * Um ambiente com mais de um usuário real precisa colocar um proxy ou gateway
 * na frente do Core que valide um token (JWT, sessão, mTLS) e reescreva
 * `X-User-Id` com o.subject autenticado. O Core não deve ser exposto
 * diretamente nesse cenário.
 *
 * O contrato de identidade foi isolado aqui justamente para que essa troca
 * aconteça em um único lugar.
 */

import { createMiddleware } from 'hono/factory';

import { ApiResponse } from '../models/message.js';

/** Header que carrega a identidade. */
export const USER_ID_HEADER = 'X-User-Id';

/** Comprimento máximo aceito para um user id. */
const MAX_USER_ID_LENGTH = 64;

/**
 * Formato aceito.
 *
 * Cobre ids opacos (`u_123`), emails e subjects de provedores de identidade,
 * que costumam usar `|` como separador (`auth0|abc123`).
 */
const USER_ID_PATTERN = /^[A-Za-z0-9._:|+@-]+$/;

/** Chave tipada sob a qual a identidade fica no contexto do Hono. */
export type IdentityVariables = {
  userId: string;
};

/**
 * Valida um user id.
 *
 * @returns O id validado, ou `null` se for inválido.
 */
export function validateUserId(
  value: string | undefined | null,
): string | null {
  if (typeof value !== 'string') return null;

  const trimmed = value.trim();

  if (trimmed.length === 0 || trimmed.length > MAX_USER_ID_LENGTH) return null;
  if (!USER_ID_PATTERN.test(trimmed)) return null;

  return trimmed;
}

/**
 * Middleware que exige e resolve a identidade do usuário.
 *
 * Anexa `userId` ao contexto. Resposta 401 quando o header está ausente ou
 * malformado.
 */
export const identity = createMiddleware<{ Variables: IdentityVariables }>(
  async (c, next) => {
    const userId = validateUserId(c.req.header(USER_ID_HEADER));

    if (!userId) {
      const response: ApiResponse = {
        success: false,
        error: `Header ${USER_ID_HEADER} ausente ou inválido`,
      };

      return c.json(response, 401);
    }

    c.set('userId', userId);

    await next();
  },
);
