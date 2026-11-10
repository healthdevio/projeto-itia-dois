import type { Schema } from 'ajv';

export interface Tool {
  name: string;
  description: string;
  input_schema: Schema;
}