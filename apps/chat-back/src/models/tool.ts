import type { Schema } from 'ajv';
import type { PermissionCode } from './permission.js';

export interface Tool {
  name: string;
  description: string;
  input_schema: Schema;
  required_permissions: PermissionCode[];
}
