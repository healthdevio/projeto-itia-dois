import { Injectable, PipeTransform } from '@nestjs/common';
import type { z } from 'zod';
import {
  ContractValidationError,
  validateContract,
} from '../../models/contract-validation.js';

@Injectable()
export class ZodValidationPipe<T> implements PipeTransform<unknown, T> {
  constructor(
    private readonly schema: z.ZodType<T>,
    private readonly contractName: string,
  ) {}

  transform(value: unknown): T {
    const result = validateContract(this.schema, value, this.contractName);
    if (!result.ok) {
      throw new ContractValidationError(this.contractName, result.issues);
    }
    return result.data;
  }
}
