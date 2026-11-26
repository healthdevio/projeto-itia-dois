/**
 * Limites provisórios para o contexto recebido do Host.
 *
 * Os valores não estão fixados no contrato (Task 01); serão confirmados com
 * Tools e Segurança. Até lá, estes padrões são conservadores e podem ser
 * ajustados por ambiente sem alterar código.
 */
export interface HostContextLimits {
  /** Tamanho máximo da resposta serializada, em bytes UTF-8. */
  maxPayloadBytes: number;
  /** Quantidade máxima de ferramentas no catálogo. */
  maxTools: number;
  /** Quantidade máxima de permissões no contexto e em cada ferramenta. */
  maxPermissions: number;
  /** Tamanho máximo do nome de uma ferramenta. */
  maxToolNameLength: number;
  /** Tamanho máximo de textos livres (descrições, system_context, etc.). */
  maxStringLength: number;
}

export const DEFAULT_HOST_CONTEXT_LIMITS: HostContextLimits = {
  maxPayloadBytes: 32 * 1024,
  maxTools: 50,
  maxPermissions: 100,
  maxToolNameLength: 256,
  maxStringLength: 4000,
};

/** Deadline aplicado pelo Core à chamada de contexto. */
export const DEFAULT_HOST_CONTEXT_TIMEOUT_MS = 5000;

function positiveInteger(
  env: NodeJS.ProcessEnv,
  name: string,
  fallback: number,
): number {
  const raw = env[name]?.trim();
  if (!raw) return fallback;

  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${name} deve ser um inteiro positivo (veio "${raw}")`);
  }
  return value;
}

/**
 * Carrega os limites do ambiente. Configuração inválida falha no boot em vez
 * de reduzir silenciosamente a proteção.
 */
export function loadHostContextLimits(
  env: NodeJS.ProcessEnv = process.env,
): HostContextLimits {
  return {
    maxPayloadBytes: positiveInteger(
      env,
      'HOST_CONTEXT_MAX_BYTES',
      DEFAULT_HOST_CONTEXT_LIMITS.maxPayloadBytes,
    ),
    maxTools: positiveInteger(
      env,
      'HOST_CONTEXT_MAX_TOOLS',
      DEFAULT_HOST_CONTEXT_LIMITS.maxTools,
    ),
    maxPermissions: positiveInteger(
      env,
      'HOST_CONTEXT_MAX_PERMISSIONS',
      DEFAULT_HOST_CONTEXT_LIMITS.maxPermissions,
    ),
    maxToolNameLength: positiveInteger(
      env,
      'HOST_CONTEXT_MAX_TOOL_NAME',
      DEFAULT_HOST_CONTEXT_LIMITS.maxToolNameLength,
    ),
    maxStringLength: positiveInteger(
      env,
      'HOST_CONTEXT_MAX_STRING',
      DEFAULT_HOST_CONTEXT_LIMITS.maxStringLength,
    ),
  };
}

export function loadHostContextTimeoutMs(
  env: NodeJS.ProcessEnv = process.env,
): number {
  return positiveInteger(
    env,
    'HOST_CONTEXT_TIMEOUT_MS',
    DEFAULT_HOST_CONTEXT_TIMEOUT_MS,
  );
}

/**
 * A integração começa desligada: sem Host escolhido, o fluxo de mensagens
 * continua se comportando como antes da Task 02.
 */
export function isHostContextEnabled(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return env.HOST_CONTEXT_ENABLED === '1';
}
