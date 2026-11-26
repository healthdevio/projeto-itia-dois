import { z } from 'zod';

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

export function createApiResponseSchema<T extends z.ZodType>(dataSchema: T) {
  return z.object({
    success: z.boolean(),
    data: dataSchema.optional(),
    error: z.string().trim().min(1, 'error não pode ser vazio').optional(),
  });
}

export const apiResponseSchema = createApiResponseSchema(z.unknown());
