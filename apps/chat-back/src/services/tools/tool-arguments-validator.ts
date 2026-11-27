import { Ajv, type ErrorObject, type Schema } from 'ajv';
import type { Tool } from '../../models/tool.js';

const ajv = new Ajv({ allErrors: true });

/**
 * Verifica se o JSON Schema recebido do Host pode ser compilado pelo mesmo Ajv
 * usado na validação de argumentos. Usa uma instância isolada e silenciosa para
 * não poluir o cache do validador nem emitir avisos com conteúdo do Host.
 */
export function isToolSchemaCompilable(schema: Schema): boolean {
  try {
    new Ajv({ allErrors: true, logger: false }).compile(schema);
    return true;
  } catch {
    return false;
  }
}

export type ToolArgumentsValidation =
  { valid: true } | { valid: false; errors: ErrorObject[] };

export function validateToolArguments(
  tool: Tool,
  argumentsValue: unknown,
): ToolArgumentsValidation {
  const validate = ajv.compile(tool.input_schema);

  if (validate(argumentsValue)) {
    return { valid: true };
  }

  return {
    valid: false,
    errors: validate.errors ?? [],
  };
}
