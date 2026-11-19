import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { Tool } from '../../../src/models/tool.js';
import type { ToolCall } from '../../../src/models/tool-call.js';
import { executeToolCall } from '../../../src/services/tools/tool-executor.js';

const searchTool: Tool = {
  name: 'buscar_cliente',
  description: 'Busca os dados de um cliente.',
  required_permissions: ['customer.read', 'customer.update'],
  input_schema: {
    type: 'object',
    properties: {
      customer_id: { type: 'string' },
    },
    required: ['customer_id'],
    additionalProperties: false,
  },
};

const validCall: ToolCall = {
  id: 'call-123',
  tool_name: 'buscar_cliente',
  arguments: { customer_id: 'cliente-123' },
  context: { conversation_id: 'conversation-123' },
};

void describe('executeToolCall', () => {
  void it('bloqueia a chamada e não executa sem permissões', async () => {
    let executorCalled = false;
    const result = await executeToolCall(searchTool, validCall, {}, () => {
      executorCalled = true;
    });

    assert.deepEqual(result, {
      success: false,
      error: 'UNAUTHORIZED',
      missing: ['customer.read', 'customer.update'],
    });
    assert.equal(executorCalled, false);
  });

  void it('bloqueia a chamada e não executa com permissões parciais', async () => {
    let executorCalled = false;
    const result = await executeToolCall(
      searchTool,
      validCall,
      { permissions: ['customer.read'] },
      () => {
        executorCalled = true;
      },
    );

    assert.deepEqual(result, {
      success: false,
      error: 'UNAUTHORIZED',
      missing: ['customer.update'],
    });
    assert.equal(executorCalled, false);
  });

  void it('não valida argumentos inválidos antes de rejeitar falta de autorização', async () => {
    let executorCalled = false;
    const invalidCall = { ...validCall, arguments: {} };
    const result = await executeToolCall(searchTool, invalidCall, {}, () => {
      executorCalled = true;
    });

    assert.deepEqual(result, {
      success: false,
      error: 'UNAUTHORIZED',
      missing: ['customer.read', 'customer.update'],
    });
    assert.equal(executorCalled, false);
  });

  void it('autoriza a ferramenta sem permissões exigidas e executa', async () => {
    let executorCalled = false;
    const publicTool: Tool = { ...searchTool, required_permissions: [] };
    const result = await executeToolCall(
      publicTool,
      validCall,
      {},
      (toolCall) => {
        executorCalled = true;
        assert.equal(toolCall, validCall);
        return 'resultado';
      },
    );

    assert.deepEqual(result, { success: true, output: 'resultado' });
    assert.equal(executorCalled, true);
  });

  void it('retorna erro de argumentos inválidos sem chamar o executor', async () => {
    let executorCalled = false;
    const invalidCall = { ...validCall, arguments: {} };
    const result = await executeToolCall(
      searchTool,
      invalidCall,
      { permissions: ['customer.read', 'customer.update'] },
      () => {
        executorCalled = true;
      },
    );

    assert.equal(result.success, false);
    assert.equal(result.error, 'INVALID_ARGUMENTS');
    assert.ok(!result.success && result.errors.length > 0);
    assert.equal(executorCalled, false);
  });

  void it('retorna erros de tipo incorreto sem chamar o executor', async () => {
    let executorCalled = false;
    const invalidCall: ToolCall = {
      ...validCall,
      arguments: { customer_id: 123 },
    };
    const result = await executeToolCall(
      searchTool,
      invalidCall,
      { permissions: ['customer.read', 'customer.update'] },
      () => {
        executorCalled = true;
      },
    );

    assert.equal(result.success, false);
    assert.equal(result.error, 'INVALID_ARGUMENTS');
    assert.ok(!result.success && result.errors.length > 0);
    assert.equal(executorCalled, false);
  });

  void it('retorna a saída do executor quando a chamada é válida', async () => {
    let executorCalled = false;
    const output = { customer_id: 'cliente-123' };
    const result = await executeToolCall(
      searchTool,
      validCall,
      { permissions: ['customer.read', 'customer.update'] },
      async () => {
        executorCalled = true;
        return output;
      },
    );

    assert.deepEqual(result, { success: true, output });
    assert.equal(executorCalled, true);
  });

  void it('converte uma exceção do executor em erro de execução', async () => {
    const result = await executeToolCall(
      searchTool,
      validCall,
      { permissions: ['customer.read', 'customer.update'] },
      () => {
        throw new Error('Falha ao consultar o cliente');
      },
    );

    assert.deepEqual(result, {
      success: false,
      error: 'EXECUTION_ERROR',
      reason: 'Falha ao consultar o cliente',
    });
  });

  void it('rejeita uma chamada cujo nome não corresponde à ferramenta', async () => {
    let executorCalled = false;
    const mismatchedCall = { ...validCall, tool_name: 'alterar_cliente' };
    const result = await executeToolCall(
      searchTool,
      mismatchedCall,
      { permissions: ['customer.read', 'customer.update'] },
      () => {
        executorCalled = true;
      },
    );

    assert.deepEqual(result, {
      success: false,
      error: 'UNAUTHORIZED',
      missing: [],
      reason: 'tool_mismatch',
    });
    assert.equal(executorCalled, false);
  });
});
