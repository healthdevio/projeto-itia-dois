/**
 * Identity Middleware
 *
 * Resolve a identidade do usuário a partir da requisição e a anexa ao
 * contexto do Hono. Todos os endpoints de conversa e de mensagem dependem
 * dele: sem identidade, não há conversa — a resposta é 401.
 *
 * O tenant (`X-Tenant-Id`) também é lido aqui, mas é **opcional** e não
 * participa da autorização: ele apenas escolhe o prompt da requisição. Ver
 * `TENANT_ID_HEADER`.
 *
 * ## Isto não é autenticação
 *
 * O Core confia no valor cru de `X-User-Id`. **Qualquer cliente pode enviar
 * o header que quiser e impersonar qualquer outro usuário.** O que existe
 * aqui é uma fronteira de identidade, não uma barreira de segurança. O mesmo
 * vale para `X-Tenant-Id`: ele escolhe um prompt, e prompts não são segredo.
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

/**
 * Header que carrega o tenant.
 *
 * Opcional: ausente, a requisição usa o prompt padrão (`DEFAULT_PROMPT`), que é
 * o caso de uma implantação de tenant único. É o que escolhe a persona — ver
 * `src/services/mia-ai/prompts.ts`.
 *
 * Passa pela mesma fronteira frouxa de `X-User-Id`: não autentica nada, e
 * qualquer valor que caia no padrão é aceitável. Ele escolhe um prompt, não
 * concede acesso a dados — o isolamento real continua vindo do `user_id`.
 */
export const TENANT_ID_HEADER = 'X-Tenant-Id';

/** Comprimento máximo aceito para um user id. */
const MAX_USER_ID_LENGTH = 64;

/** Comprimento máximo aceito para um tenant id. */
const MAX_TENANT_ID_LENGTH = 64;

/**
 * Formato aceito.
 *
 * Cobre ids opacos (`u_123`), emails e subjects de provedores de identidade,
 * que costumam usar `|` como separador (`auth0|abc123`).
 */
const USER_ID_PATTERN = /^[A-Za-z0-9._:|+@-]+$/;

/**
 * Formato aceito para o tenant id.
 *
 * Mais estreito que o do usuário, porque não há id de tenant vindo de
 * provedores de identidade: são ids que a própria implantação escolhe
 * (`clinica-aurora`), então basta o alfabético, o numérico, o ponto, o hífen
 * e o sublinhado.
 */
const TENANT_ID_PATTERN = /^[A-Za-z0-9._-]+$/;

/** Chave tipada sob a qual a identidade fica no contexto do Hono. */
export type IdentityVariables = {
  userId: string;

  /**
   * Tenant da requisição, ou `undefined` quando o header não veio.
   *
   * `undefined` é diferente de string vazia de propósito: é o sinal de que o
   * prompt padrão vale, e não de que um tenant sem nome foi pedido.
   */
  tenantId?: string;
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
 * Valida um tenant id.
 *
 * Ao contrário do user id, um tenant inválido **não** derruba a requisição: um
 * valor malformado ou ausente significa "use o prompt padrão". O tenant escolhe
 * a persona, não concede acesso, e um header estragado não tem motivo para
 * transformar o chat em 401.
 *
 * @returns O id validado, ou `undefined` para usar o prompt padrão.
 */
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

    // Ausente ou inválido: sem tenant, o prompt padrão vale. Nunca é 401.
    const tenantId = validateTenantId(c.req.header(TENANT_ID_HEADER));

    if (tenantId !== undefined) {
      c.set('tenantId', tenantId);
    }

    await next();
  },
);
