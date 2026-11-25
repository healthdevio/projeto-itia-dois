import { z } from 'zod';

export type PermissionCode = `${string}.${string}`;

const PERMISSION_CODE_REGEX = /^[^.\s]+\.[^.\s]+(?:\.[^.\s]+)*$/;

export function isPermissionCode(value: string): value is PermissionCode {
  return PERMISSION_CODE_REGEX.test(value);
}

export const permissionCodeSchema = z.string().trim().refine(isPermissionCode, {
  message: 'permission deve seguir o formato recurso.acao (ex.: chat.read)',
});
