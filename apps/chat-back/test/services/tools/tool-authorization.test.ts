import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { Tool } from '../../../src/models/tool.js';
import type { ToolCall } from '../../../src/models/tool-call.js';
import { authorizeToolCall } from '../../../src/services/tools/tool-authorization.js';

const searchTool: Tool = {
  name: 'buscar_cliente',
  description: 'Busca os dados de um cliente.',
  required_permissions: ['customer.read'],
  input_schema: { type: 'object' },
};

const toolCall: ToolCall = {
  id: 'call-123',
  tool_name: 'buscar_cliente',
  arguments: { customer_id: 'cliente-123' },
  context: { conversation_id: 'conversation-123' },
};

void describe('authorizeToolCall', () => {
  void it('autoriza quando todas as permissões exigidas estão concedidas', () => {
    const result = authorizeToolCall(searchTool, toolCall, {
      permissions: ['customer.read', 'customer.update'],
    });

    assert.deepEqual(result, { authorized: true });
  });

  void it('rejeita quando falta uma permissão exigida', () => {
    const result = authorizeToolCall(searchTool, toolCall, {
      permissions: ['customer.update'],
    });

    assert.deepEqual(result, {
      authorized: false,
      reason: 'missing_permissions',
      missing_permissions: ['customer.read'],
    });
  });

  void it('rejeita quando falta uma das várias permissões exigidas', () => {
    const updateTool: Tool = {
      ...searchTool,
      required_permissions: ['customer.read', 'customer.update'],
    };
    const result = authorizeToolCall(updateTool, toolCall, {
      permissions: ['customer.read'],
    });

    assert.deepEqual(result, {
      authorized: false,
      reason: 'missing_permissions',
      missing_permissions: ['customer.update'],
    });
  });

  void it('rejeita quando o contexto não contém permissões', () => {
    const result = authorizeToolCall(searchTool, toolCall, {});

    assert.deepEqual(result, {
      authorized: false,
      reason: 'missing_permissions',
      missing_permissions: ['customer.read'],
    });
  });

  void it('autoriza uma ferramenta sem permissões exigidas', () => {
    const publicTool: Tool = { ...searchTool, required_permissions: [] };
    const result = authorizeToolCall(publicTool, toolCall, {});

    assert.deepEqual(result, { authorized: true });
  });

  void it('rejeita quando o nome da chamada não corresponde à ferramenta', () => {
    const mismatchedCall = { ...toolCall, tool_name: 'alterar_cliente' };
    const result = authorizeToolCall(searchTool, mismatchedCall, {
      permissions: ['customer.read'],
    });

    assert.deepEqual(result, {
      authorized: false,
      reason: 'tool_mismatch',
    });
  });
});
