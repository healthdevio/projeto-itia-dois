import {
  HostIntegrationError,
  type HostToolOutput,
} from '../../models/host-integration.js';
import type { HostExecutionLimits } from './host-execution.config.js';

const MAX_JSON_DEPTH = 10;
const RESERVED_KEYS = new Set(['__proto__', 'prototype', 'constructor']);

function invalid(reason: string): HostIntegrationError {
  return new HostIntegrationError(
    'unknown',
    `Resultado do Host inválido: ${reason}`,
  );
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function sanitize(
  value: unknown,
  depth: number,
  field: string,
): HostToolOutput {
  if (depth > MAX_JSON_DEPTH) {
    throw invalid(`${field} excede a profundidade máxima`);
  }
  if (value === null) return null;

  switch (typeof value) {
    case 'string':
    case 'boolean':
      return value;
    case 'number':
      if (!Number.isFinite(value)) {
        throw invalid(`${field} contém número inválido`);
      }
      return value;
    case 'object': {
      if (Array.isArray(value)) {
        return value.map((item, index) =>
          sanitize(item, depth + 1, `${field}[${index}]`),
        );
      }
      if (!isPlainObject(value)) {
        throw invalid(`${field} deve ser um objeto JSON`);
      }

      const output: Record<string, HostToolOutput> = {};
      for (const [key, item] of Object.entries(value)) {
        if (RESERVED_KEYS.has(key)) {
          throw invalid(`${field} contém chave reservada`);
        }
        output[key] = sanitize(item, depth + 1, `${field}.${key}`);
      }
      return output;
    }
    default:
      throw invalid(`${field} contém valor que não é JSON`);
  }
}

/**
 * O resultado vem do Host e pode entrar no prompt. Só é aceito depois de
 * reconstruído como JSON puro e limitado em tamanho; nada é logado aqui.
 */
export function parseHostToolOutput(
  value: unknown,
  limits: HostExecutionLimits,
): HostToolOutput {
  const output = sanitize(value, 0, 'output');

  let serialized: string | undefined;
  try {
    serialized = JSON.stringify(output);
  } catch {
    throw invalid('não é serializável como JSON');
  }
  if (serialized === undefined) {
    throw invalid('não é serializável como JSON');
  }
  if (Buffer.byteLength(serialized, 'utf8') > limits.maxOutputBytes) {
    throw invalid(`excede ${limits.maxOutputBytes} bytes`);
  }

  return output;
}
