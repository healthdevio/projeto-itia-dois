import { positiveInteger } from './host-context.config.js';

/**
 * Limites provisórios aplicados ao resultado de uma ferramenta executada pelo
 * Host. O valor não está fixado no contrato (Task 01) e precisa ser confirmado
 * com Tools e Segurança antes de produção.
 */
export interface HostExecutionLimits {
  /** Tamanho máximo do resultado serializado em UTF-8, em bytes. */
  maxOutputBytes: number;
}

export const DEFAULT_HOST_EXECUTION_LIMITS: HostExecutionLimits = {
  maxOutputBytes: 16 * 1024,
};

/** Deadline aplicado pelo Core à execução da ferramenta no Host. */
export const DEFAULT_HOST_EXECUTION_TIMEOUT_MS = 5000;

export function loadHostExecutionLimits(
  env: NodeJS.ProcessEnv = process.env,
): HostExecutionLimits {
  return {
    maxOutputBytes: positiveInteger(
      env,
      'HOST_EXECUTION_MAX_OUTPUT_BYTES',
      DEFAULT_HOST_EXECUTION_LIMITS.maxOutputBytes,
    ),
  };
}

export function loadHostExecutionTimeoutMs(
  env: NodeJS.ProcessEnv = process.env,
): number {
  return positiveInteger(
    env,
    'HOST_EXECUTION_TIMEOUT_MS',
    DEFAULT_HOST_EXECUTION_TIMEOUT_MS,
  );
}
