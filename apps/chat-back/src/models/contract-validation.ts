import type { z } from 'zod';

export interface ContractValidationIssue {
  path: string;
  code: string;
  message: string;
}

export type ContractValidationResult<T> =
  | {
      ok: true;
      data: T;
    }
  | {
      ok: false;
      error: string;
      issues: ContractValidationIssue[];
    };

export class ContractValidationError extends Error {
  constructor(
    readonly contractName: string,
    readonly issues: ContractValidationIssue[],
  ) {
    super(formatContractValidationError(contractName, issues));
    this.name = 'ContractValidationError';
  }
}

export function formatContractValidationError(
  contractName: string,
  issues: ContractValidationIssue[],
): string {
  if (issues.length === 0) {
    return `Contrato ${contractName} inválido`;
  }

  const details = issues
    .map((issue) =>
      issue.path ? `${issue.path}: ${issue.message}` : issue.message,
    )
    .join('; ');

  return `Contrato ${contractName} inválido: ${details}`;
}

export function validateContract<T>(
  schema: z.ZodType<T>,
  value: unknown,
  contractName: string,
): ContractValidationResult<T> {
  const parsed = schema.safeParse(value);

  if (parsed.success) {
    return { ok: true, data: parsed.data };
  }

  const issues: ContractValidationIssue[] = parsed.error.issues.map(
    (issue) => ({
      path: issue.path.map(String).join('.'),
      code: issue.code,
      message: issue.message,
    }),
  );

  return {
    ok: false,
    error: formatContractValidationError(contractName, issues),
    issues,
  };
}
