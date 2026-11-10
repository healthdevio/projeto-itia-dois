import { Ajv, type ErrorObject } from 'ajv';
import type { Tool } from '../../models/tool.js';

const ajv = new Ajv({ allErrors: true });

export type ToolArgumentsValidation =
  | { valid: true }
  | { valid: false; errors: ErrorObject[] };

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