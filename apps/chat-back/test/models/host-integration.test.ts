import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  HOST_INTEGRATION_CONTRACT_VERSION,
  HostIntegrationError,
  type HostPrincipal,
} from '../../src/models/host-integration.js';
import type { Tool } from '../../src/models/tool.js';
import type { ToolCall } from '../../src/models/tool-call.js';
import { createFakeHost } from '../helpers/host-integration.fake.js';

const principal: HostPrincipal = {
  user_id: 'user-123',
  tenant_id: 'tenant-123',
};

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

const searchCall: ToolCall = {
  id: 'call-123',
  tool_name: 'buscar_cliente',
  arguments: { customer_id: 'cliente-123' },
  context: { conversation_id: 'conversation-123' },
};

void describe('contrato HostIntegration (adaptador em memória)', () => {
  void it('expõe uma versão do contrato', () => {
    assert.equal(typeof HOST_INTEGRATION_CONTRACT_VERSION, 'string');
    assert.match(HOST_INTEGRATION_CONTRACT_VERSION, /^\d+\.\d+\.\d+$/);
  });

  void it('retorna contexto e ferramentas juntos para o principal', async () => {
    const host = createFakeHost({
      chat_context: {
        user: { display_name: 'Ana' },
        permissions: ['customer.read'],
      },
      tools: [searchTool],
    });

    const result = await host.loadConversationContext({
      principal,
      conversation_id: 'conversation-123',
    });

    assert.deepEqual(result.chat_context.permissions, ['customer.read']);
    assert.deepEqual(
      result.tools.map((tool) => tool.name),
      ['buscar_cliente'],
    );
    assert.equal(host.context_requests.length, 1);
    assert.equal(host.context_requests[0].principal.user_id, 'user-123');
  });

  void it('aceita contexto vazio quando o principal não tem escopo', async () => {
    const host = createFakeHost();

    const result = await host.loadConversationContext({
      principal,
      conversation_id: 'conversation-123',
    });

    assert.deepEqual(result, { chat_context: {}, tools: [] });
  });

  void it('recusa contexto quando o Host exige tenant ausente', async () => {
    const host = createFakeHost({ require_tenant: true });

    await assert.rejects(
      host.loadConversationContext({
        principal: { user_id: 'user-123' },
        conversation_id: 'conversation-123',
      }),
      (error: unknown) =>
        error instanceof HostIntegrationError && error.code === 'forbidden',
    );
  });

  void it('rejeita ferramenta inexistente com not_found e sem efeito colateral', async () => {
    const host = createFakeHost({
      chat_context: { permissions: ['customer.read'] },
      tools: [searchTool],
    });

    await assert.rejects(
      host.executeTool({
        principal,
        tool_call: { ...searchCall, tool_name: 'ferramenta_inexistente' },
      }),
      (error: unknown) =>
        error instanceof HostIntegrationError && error.code === 'not_found',
    );

    assert.equal(host.executed_calls.length, 0);
  });

  void it('recusa chamada sem grant com forbidden e sem efeito colateral', async () => {
    const host = createFakeHost({
      chat_context: { permissions: [] },
      tools: [searchTool],
    });

    await assert.rejects(
      host.executeTool({ principal, tool_call: searchCall }),
      (error: unknown) =>
        error instanceof HostIntegrationError && error.code === 'forbidden',
    );

    assert.equal(host.executed_calls.length, 0);
  });

  void it('executa chamada autorizada e devolve a saída JSON', async () => {
    const host = createFakeHost({
      chat_context: { permissions: ['customer.read'] },
      tools: [searchTool],
      outputs: { buscar_cliente: { customer_id: 'cliente-123' } },
    });

    const output = await host.executeTool({ principal, tool_call: searchCall });

    assert.deepEqual(output, { customer_id: 'cliente-123' });
    assert.equal(host.executed_calls.length, 1);
    assert.equal(host.executed_calls[0].id, 'call-123');
  });

  void it('propaga falha do Host como erro tipado, não como sucesso vazio', async () => {
    const host = createFakeHost({
      chat_context: { permissions: ['customer.read'] },
      tools: [searchTool],
      fail_with: new HostIntegrationError(
        'host_unavailable',
        'Host fora do ar.',
      ),
    });

    await assert.rejects(
      host.executeTool({ principal, tool_call: searchCall }),
      (error: unknown) =>
        error instanceof HostIntegrationError &&
        error.code === 'host_unavailable',
    );

    assert.equal(host.executed_calls.length, 0);
  });
});
