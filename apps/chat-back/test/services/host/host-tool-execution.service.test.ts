import 'reflect-metadata';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { Test } from '@nestjs/testing';

import type { RequestIdentity } from '../../../src/middleware/identity.js';
import {
  HostIntegrationError,
  type HostIntegration,
  type HostToolExecutionRequest,
  type HostToolOutput,
} from '../../../src/models/host-integration.js';
import type { PermissionCode } from '../../../src/models/permission.js';
import type { Tool } from '../../../src/models/tool.js';
import type { ToolCall } from '../../../src/models/tool-call.js';
import { DEFAULT_HOST_CONTEXT_LIMITS } from '../../../src/services/host/host-context.config.js';
import { HostContextService } from '../../../src/services/host/host-context.service.js';
import {
  DEFAULT_HOST_EXECUTION_LIMITS,
  type HostExecutionLimits,
} from '../../../src/services/host/host-execution.config.js';
import { HostModule } from '../../../src/services/host/host.module.js';
import {
  HostToolCatalogService,
  type HostToolCatalogResult,
} from '../../../src/services/host/host-tool-catalog.service.js';
import { HostToolExecutionService } from '../../../src/services/host/host-tool-execution.service.js';
import {
  createFakeHost,
  type FakeHostOptions,
} from '../../helpers/host-integration.fake.js';

const identity: RequestIdentity = {
  userId: 'user-123',
  tenantId: 'tenant-123',
};
const otherIdentity: RequestIdentity = {
  userId: 'user-999',
  tenantId: 'tenant-999',
};
const conversationId = 'conversation-123';

const tool: Tool = {
  name: 'buscar_cliente',
  description: 'Busca os dados de um cliente.',
  input_schema: {
    type: 'object',
    properties: { customer_id: { type: 'string' } },
    required: ['customer_id'],
    additionalProperties: false,
  },
  required_permissions: ['customer.read'] as PermissionCode[],
};

const toolCall: ToolCall = {
  id: 'call-123',
  tool_name: 'buscar_cliente',
  arguments: { customer_id: 'cliente-123' },
  context: { conversation_id: conversationId },
};

const neverResolves = (): Promise<never> => new Promise<never>(() => undefined);
const delay = (ms: number): Promise<void> =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

function catalog(
  overrides: Partial<HostToolCatalogResult> = {},
): HostToolCatalogResult {
  return {
    tools: [tool],
    chat_context: { permissions: ['customer.read'] },
    discarded: { invalid_schema: 0, not_allowed: 0 },
    identity,
    conversationId,
    ...overrides,
  };
}

function fakeHost(options: Partial<FakeHostOptions> = {}) {
  return createFakeHost({
    chat_context: { permissions: ['customer.read'] },
    tools: [tool],
    ...options,
  });
}

function service(
  host: HostIntegration,
  options: { limits?: HostExecutionLimits; timeoutMs?: number } = {},
): HostToolExecutionService {
  const context = new HostContextService(
    host,
    DEFAULT_HOST_CONTEXT_LIMITS,
    1000,
  );
  return new HostToolExecutionService(
    host,
    new HostToolCatalogService(context),
    options.limits ?? DEFAULT_HOST_EXECUTION_LIMITS,
    options.timeoutMs ?? 1000,
  );
}

function hostWith(
  execute: (request: HostToolExecutionRequest) => Promise<HostToolOutput>,
): HostIntegration {
  return {
    async loadConversationContext() {
      return { chat_context: {}, tools: [] };
    },
    executeTool: execute,
  };
}

void describe('HostToolExecutionService', () => {
  void it('executa chamada autorizada e válida uma única vez', async () => {
    const host = fakeHost({ outputs: { buscar_cliente: { ok: true } } });

    const result = await service(host).executeToolCall({
      identity,
      conversationId,
      toolCall,
      catalog: catalog(),
    });

    assert.equal(result.success, true);
    if (result.success) {
      assert.deepEqual(result.output, { ok: true });
      assert.equal(result.host_called, true);
    }
    assert.equal(host.executed_calls.length, 1);
    assert.equal(host.executed_calls[0].id, 'call-123');
  });

  void it('carrega o catálogo pela Task 03 quando ele não é informado', async () => {
    const host = fakeHost({ outputs: { buscar_cliente: 'ok' } });

    const result = await service(host).executeToolCall({
      identity,
      conversationId,
      toolCall,
    });

    assert.equal(result.success, true);
    assert.equal(host.context_requests.length, 1);
    assert.equal(host.executed_calls.length, 1);
  });

  void it('sem grant, bloqueia sem chamar o Host', async () => {
    const host = fakeHost();

    const result = await service(host).executeToolCall({
      identity,
      conversationId,
      toolCall,
      catalog: catalog({ chat_context: { permissions: [] } }),
    });

    assert.equal(result.success, false);
    if (!result.success) {
      assert.equal(result.stage, 'authorization');
      assert.equal(result.code, 'forbidden');
      assert.equal(result.host_called, false);
    }
    assert.equal(host.executed_calls.length, 0);
  });

  void it('ferramenta inexistente no catálogo é recusada sem chamar o Host', async () => {
    const host = fakeHost();

    const result = await service(host).executeToolCall({
      identity,
      conversationId,
      toolCall,
      catalog: catalog({ tools: [] }),
    });

    assert.equal(result.success, false);
    if (!result.success) {
      assert.equal(result.stage, 'catalog');
      assert.equal(result.host_called, false);
    }
    assert.equal(host.executed_calls.length, 0);
  });

  void it('argumentos inválidos são recusados sem chamar o Host', async () => {
    const host = fakeHost();

    const result = await service(host).executeToolCall({
      identity,
      conversationId,
      toolCall: { ...toolCall, arguments: {} },
      catalog: catalog(),
    });

    assert.equal(result.success, false);
    if (!result.success) {
      assert.equal(result.stage, 'arguments');
      assert.equal(result.error, 'INVALID_ARGUMENTS');
      assert.equal(result.code, 'invalid_arguments');
      assert.equal(result.host_called, false);
    }
    assert.equal(host.executed_calls.length, 0);
  });

  void it('autorização é avaliada antes da validação de argumentos', async () => {
    const host = fakeHost();

    const result = await service(host).executeToolCall({
      identity,
      conversationId,
      toolCall: { ...toolCall, arguments: {} },
      catalog: catalog({ chat_context: { permissions: [] } }),
    });

    assert.equal(result.success, false);
    if (!result.success) {
      assert.equal(result.stage, 'authorization');
      assert.equal(result.code, 'forbidden');
    }
    assert.equal(host.executed_calls.length, 0);
  });

  void it('conversation_id divergente da conversa verificada é recusada', async () => {
    const host = fakeHost();

    const result = await service(host).executeToolCall({
      identity,
      conversationId,
      toolCall: {
        ...toolCall,
        context: { conversation_id: 'conversation-outra' },
      },
      catalog: catalog(),
    });

    assert.equal(result.success, false);
    if (!result.success) {
      assert.equal(result.stage, 'scope');
      assert.equal(result.code, 'forbidden');
      assert.equal(result.host_called, false);
    }
    assert.equal(host.executed_calls.length, 0);
  });

  void it('catálogo de outra identidade ou conversa é recusado', async () => {
    const host = fakeHost();

    for (const badCatalog of [
      catalog({ identity: otherIdentity }),
      catalog({ conversationId: 'conversation-outra' }),
    ]) {
      const result = await service(host).executeToolCall({
        identity,
        conversationId,
        toolCall,
        catalog: badCatalog,
      });

      assert.equal(result.success, false);
      if (!result.success) assert.equal(result.stage, 'catalog');
    }
    assert.equal(host.executed_calls.length, 0);
  });

  void it('principal indicado pela IA é ignorado', async () => {
    const toolWithPrincipal: Tool = {
      ...tool,
      input_schema: {
        type: 'object',
        properties: {
          customer_id: { type: 'string' },
          principal: { type: 'object' },
        },
        required: ['customer_id'],
        additionalProperties: false,
      },
    };
    let received: HostToolExecutionRequest | undefined;
    const host = hostWith(async (request) => {
      received = request;
      return { ok: true };
    });

    const result = await service(host).executeToolCall({
      identity,
      conversationId,
      toolCall: {
        ...toolCall,
        arguments: {
          customer_id: 'cliente-123',
          principal: { user_id: 'atacante', tenant_id: 'tenant-999' },
        },
      },
      catalog: catalog({ tools: [toolWithPrincipal] }),
    });

    assert.equal(result.success, true);
    assert.ok(received);
    assert.deepEqual(received.principal, {
      user_id: 'user-123',
      tenant_id: 'tenant-123',
    });
  });

  void it('recusa do Host vira erro tipado, nunca sucesso vazio', async () => {
    const host = hostWith(async () => {
      throw new HostIntegrationError('forbidden', 'Host revalidou e negou');
    });

    const result = await service(host).executeToolCall({
      identity,
      conversationId,
      toolCall,
      catalog: catalog(),
    });

    assert.equal(result.success, false);
    if (!result.success) {
      assert.equal(result.code, 'forbidden');
      assert.equal(result.stage, 'host');
      assert.equal(result.host_called, true);
      assert.equal(result.uncertain, false);
    }
  });

  void it('falha de comunicação do Host é propagada sem retry', async () => {
    let calls = 0;
    const host = hostWith(async () => {
      calls += 1;
      throw new HostIntegrationError('host_unavailable', 'Host fora do ar');
    });

    const result = await service(host).executeToolCall({
      identity,
      conversationId,
      toolCall,
      catalog: catalog(),
    });

    assert.equal(result.success, false);
    if (!result.success) assert.equal(result.code, 'host_unavailable');
    assert.equal(calls, 1);
  });

  void it('timeout é estado incerto, sem retry, mesmo se o adaptador ignorar o sinal', async () => {
    let calls = 0;
    const host = hostWith(() => {
      calls += 1;
      return neverResolves();
    });

    const result = await service(host, { timeoutMs: 20 }).executeToolCall({
      identity,
      conversationId,
      toolCall,
      catalog: catalog(),
    });

    assert.equal(result.success, false);
    if (!result.success) {
      assert.equal(result.code, 'timeout');
      assert.equal(result.uncertain, true);
      assert.equal(result.host_called, true);
    }
    assert.equal(calls, 1);
  });

  void it('AbortSignal do chamador é estado incerto, sem retry', async () => {
    let calls = 0;
    const host = hostWith(() => {
      calls += 1;
      return neverResolves();
    });
    const controller = new AbortController();

    const loading = service(host).executeToolCall({
      identity,
      conversationId,
      toolCall,
      catalog: catalog(),
      signal: controller.signal,
    });
    controller.abort();
    const result = await loading;

    assert.equal(result.success, false);
    if (!result.success) {
      assert.equal(result.uncertain, true);
      assert.equal(result.stage, 'host');
    }
    assert.equal(calls, 1);
  });

  void it('propaga o AbortSignal e o id da chamada ao adaptador', async () => {
    let received: HostToolExecutionRequest | undefined;
    const host = hostWith(async (request) => {
      received = request;
      return null;
    });
    const controller = new AbortController();

    await service(host).executeToolCall({
      identity,
      conversationId,
      toolCall,
      catalog: catalog(),
      signal: controller.signal,
    });

    assert.ok(received);
    assert.equal(received.tool_call.id, 'call-123');
    assert.ok(received.signal);
    assert.equal(received.signal.aborted, false);
  });

  void it('resultado não serializável é rejeitado', async () => {
    const host = hostWith(async () => undefined as unknown as HostToolOutput);

    const result = await service(host).executeToolCall({
      identity,
      conversationId,
      toolCall,
      catalog: catalog(),
    });

    assert.equal(result.success, false);
    if (!result.success) {
      assert.equal(result.stage, 'result');
      assert.equal(result.code, 'unknown');
    }
  });

  void it('resultado acima do limite é rejeitado', async () => {
    const host = hostWith(async () => 'x'.repeat(20 * 1024));
    const limits = { maxOutputBytes: 16 * 1024 };

    const result = await service(host, { limits }).executeToolCall({
      identity,
      conversationId,
      toolCall,
      catalog: catalog(),
    });

    assert.equal(result.success, false);
    if (!result.success) {
      assert.equal(result.stage, 'result');
      assert.equal(result.host_called, true);
    }
  });

  void it('mesma ToolCall concorrente é encaminhada apenas uma vez', async () => {
    let calls = 0;
    const host = hostWith(async () => {
      calls += 1;
      await delay(20);
      return { ok: true };
    });
    const execution = service(host);

    const results = await Promise.all([
      execution.executeToolCall({
        identity,
        conversationId,
        toolCall,
        catalog: catalog(),
      }),
      execution.executeToolCall({
        identity,
        conversationId,
        toolCall,
        catalog: catalog(),
      }),
    ]);

    assert.equal(results.filter((result) => result.success).length, 1);
    assert.equal(calls, 1);
    const duplicate = results.find((result) => !result.success);
    assert.ok(duplicate && !duplicate.success);
    if (duplicate && !duplicate.success) {
      assert.equal(duplicate.stage, 'duplicate');
    }
  });

  void it('auditoria não registra argumentos, resultado nem segredos', async () => {
    const secret = 'SEGREDO-NAO-LOGAR';
    const host = hostWith(async () => ({ token: secret }));
    const logs: string[] = [];
    const original = console.log;
    console.log = (...args: unknown[]) => {
      logs.push(args.join(' '));
    };

    try {
      await service(host).executeToolCall({
        identity,
        conversationId,
        toolCall: { ...toolCall, arguments: { customer_id: secret } },
        catalog: catalog(),
      });
    } finally {
      console.log = original;
    }

    const lines = logs.filter((line) => line.includes('host.tool_execution'));
    assert.equal(lines.length, 1);
    const entry = JSON.parse(lines[0]) as Record<string, unknown>;
    assert.equal(entry.event, 'host.tool_execution');
    assert.equal(entry.user_id, 'user-123');
    assert.equal(entry.tenant_id, 'tenant-123');
    assert.equal(entry.tool, 'buscar_cliente');
    assert.equal(entry.conversation_id, conversationId);
    assert.equal(entry.tool_call_id, 'call-123');
    assert.equal(entry.outcome, 'success');
    assert.ok(typeof entry.at === 'string');
    assert.ok(typeof entry.duration_ms === 'number');
    assert.ok(!lines[0].includes(secret));
  });

  void it('o módulo Nest resolve o serviço com o provider padrão sem Host', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [HostModule],
    }).compile();

    try {
      const execution = moduleRef.get(HostToolExecutionService);
      const result = await execution.executeToolCall({
        identity,
        conversationId,
        toolCall,
        catalog: catalog(),
      });

      assert.equal(result.success, false);
      if (!result.success) {
        assert.equal(result.code, 'host_unavailable');
        assert.equal(result.host_called, true);
      }
    } finally {
      await moduleRef.close();
    }
  });
});
