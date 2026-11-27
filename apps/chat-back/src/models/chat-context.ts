import { z } from 'zod';
import { chatConfigSchema, type ChatConfig } from './chat-config.js';
import { permissionCodeSchema, type PermissionCode } from './permission.js';

export interface ChatContext {
  user?: Record<string, unknown>;
  profile?: Record<string, unknown>;
  preferences?: ChatConfig;
  session?: Record<string, unknown>;
  current_page?: string;
  permissions?: PermissionCode[];
  system_context?: string;
}

const recordObjectSchema = z.record(z.string(), z.unknown());

export const chatContextSchema = z.object({
  user: recordObjectSchema.optional(),
  profile: recordObjectSchema.optional(),
  preferences: chatConfigSchema.optional(),
  session: recordObjectSchema.optional(),
  current_page: z
    .string()
    .trim()
    .min(1, 'current_page não pode ser vazio')
    .optional(),
  permissions: z.array(permissionCodeSchema).optional(),
  system_context: z.string().optional(),
});
