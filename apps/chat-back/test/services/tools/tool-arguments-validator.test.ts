import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { Tool } from '../../../src/models/tool.js';
import { validateToolArguments } from '../../../src/services/tools/tool-arguments-validator.js';

const searchTool: Tool = {
  name: 'buscar_cliente',
  description: 'Busca os dados de um cliente.',
  required_permissions: ['customer.read'],
  input_schema: {
    type: 'object',
    properties: {
      customer_id: { type: 'string' },
    },
    required: ['customer_id'],
    additionalProperties: false,
  },
};

void describe('validateToolArguments', () => {
  void it('aceita argumentos que seguem o schema', () => {
    const result = validateToolArguments(searchTool, {
      customer_id: 'cliente-123',
    });

    assert.deepEqual(result, { valid: true });
  });

  void it('rejeita argumentos sem o campo obrigatório', () => {
    const result = validateToolArguments(searchTool, {});

    assert.equal(result.valid, false);
    assert.ok(!result.valid && result.errors.length > 0);
  });

  void it('rejeita argumentos com tipo incorreto', () => {
    const result = validateToolArguments(searchTool, {
      customer_id: 123,
    });

    assert.equal(result.valid, false);
    assert.ok(!result.valid && result.errors.length > 0);
  });

  void it('rejeita propriedades não declaradas no schema', () => {
    const result = validateToolArguments(searchTool, {
      customer_id: 'cliente-123',
      admin: true,
    });

    assert.equal(result.valid, false);
    assert.ok(!result.valid && result.errors.length > 0);
  });
});
