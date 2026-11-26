import 'reflect-metadata';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { Test } from '@nestjs/testing';
import type { Schema } from 'ajv';

import type { RequestIdentity } from '../../../src/middleware/identity.js';
import {
  HostIntegrationError,
  type HostContextRequest,
  type HostConversationContext,
  type HostIntegration,
} from '../../../src/models/host-integration.js';
import type { PermissionCode } from '../../../src/models/permission.js';
import type { Tool } from '../../../src/models/tool.js';
import {
  DEFAULT_HOST_CONTEXT_LIMITS,
  type HostContextLimits,
} from '../../../src/services/host/host-context.config.js';
import { HostContextService } from '../../../src/services/host/host-context.service.js';
import { HostModule } from '../../../src/services/host/host.module.js';
import { HostToolCatalogService } from '../../../src/services/host/host-tool-catalog.service.js';
import { createFakeHost } from '../../helpers/host-integration.fake.js';

const identity: RequestIdentity = {
  userId: 'user-123',
  tenantId: 'tenant-123',
};
const conversationId = 'conversation-123';

const neverResolves = (): Promise<never> => new Promise<never>(() => undefined);

function makeTool(overrides: Partial<Tool> = {}): Tool {
  return {
    name: 'buscar_cliente',
    description: 'Busca os dados de um cliente.',
    input_schema: { type: 'object' },
    required_permissions: ['customer.read'] as PermissionCode[],
    ...overrides,
  };
}

function service(
  host: HostIntegration,
  options: { limits?: HostContextLimits; timeoutMs?: number } = {},
): HostToolCatalogService {
  const context = new HostContextService(
    host,
    options.limits ?? DEFAULT_HOST_CONTEXT_LIMITS,
    options.timeoutMs ?? 1000,
  );
  return new HostToolCatalogService(context);
}

function hostReturning(
  load: (request: HostContextRequest) => Promise<HostConversationContext>,
): HostIntegration {
  return {
    loadConversationContext: load,
    async executeTool() {
      throw new Error('não usado neste teste');
    },
  };
}

void describe('HostToolCatalogService', () => {
  void it('expõe somente as ferramentas que o principal pode usar', async () => {
    const host = createFakeHost({
      chat_context: { permissions: ['customer.read'] },
      tools: [
        makeTool(),
        makeTool({
          name: 'listar_pedidos',
          required_permissions: ['order.read'] as PermissionCode[],
        }),
        makeTool({ name: 'ajuda', required_permissions: [] }),
      ],
    });

    const result = await service(host).getAvailableTools({
      identity,
      conversationId,
    });

    assert.deepEqual(
      result.tools.map((tool) => tool.name),
      ['buscar_cliente', 'ajuda'],
    );
    assert.deepEqual(result.discarded, {
      invalid_schema: 0,
      not_allowed: 1,
    });
    assert.deepEqual(result.chat_context.permissions, ['customer.read']);
  });

  void it('sem grants, não expõe ferramentas que exigem permissão', async () => {
    const host = createFakeHost({
      tools: [makeTool(), makeTool({ name: 'listar_pedidos' })],
    });

    const result = await service(host).getAvailableTools({
      identity,
      conversationId,
    });

    assert.deepEqual(result.tools, []);
    assert.equal(result.discarded.not_allowed, 2);
  });

  void it('descarta ferramenta com JSON Schema não compilável pelo Ajv', async () => {
    const host = createFakeHost({
      chat_context: { permissions: ['customer.read'] },
      tools: [
        makeTool({
          input_schema: { type: 'tipo-inexistente' } as unknown as Schema,
        }),
      ],
    });

    const result = await service(host).getAvailableTools({
      identity,
      conversationId,
    });

    assert.deepEqual(result.tools, []);
    assert.deepEqual(result.discarded, {
      invalid_schema: 1,
      not_allowed: 0,
    });
  });

  void it('rejeita a resposta com nomes duplicados', async () => {
    const host = createFakeHost({ tools: [makeTool(), makeTool()] });

    await assert.rejects(
      service(host).getAvailableTools({ identity, conversationId }),
      (error: unknown) =>
        error instanceof HostIntegrationError &&
        error.code === 'unknown' &&
        /duplicado/.test(error.message),
    );
  });

  void it('rejeita permissão em formato inválido', async () => {
    const host = createFakeHost({
      tools: [
        makeTool({
          required_permissions: ['semformato'] as unknown as PermissionCode[],
        }),
      ],
    });

    await assert.rejects(
      service(host).getAvailableTools({ identity, conversationId }),
      (error: unknown) =>
        error instanceof HostIntegrationError &&
        error.code === 'unknown' &&
        /permissão inválida/.test(error.message),
    );
  });

  void it('aplica os limites de tamanho ao catálogo recebido', async () => {
    const host = createFakeHost({
      tools: [makeTool(), makeTool({ name: 'listar_pedidos' })],
    });
    const limits = { ...DEFAULT_HOST_CONTEXT_LIMITS, maxTools: 1 };

    await assert.rejects(
      service(host, { limits }).getAvailableTools({
        identity,
        conversationId,
      }),
      (error: unknown) =>
        error instanceof HostIntegrationError &&
        error.code === 'unknown' &&
        /excede o limite/.test(error.message),
    );
  });

  void it('propaga falhas do Host como erro tipado, nunca catálogo vazio', async () => {
    for (const code of ['host_unavailable', 'timeout'] as const) {
      const host = createFakeHost({
        fail_with: new HostIntegrationError(code, 'falha do Host'),
      });

      await assert.rejects(
        service(host).getAvailableTools({ identity, conversationId }),
        (error: unknown) =>
          error instanceof HostIntegrationError && error.code === code,
      );
    }
  });

  void it('impõe timeout mesmo se o adaptador ignorar o sinal', async () => {
    await assert.rejects(
      service(hostReturning(neverResolves), {
        timeoutMs: 20,
      }).getAvailableTools({ identity, conversationId }),
      (error: unknown) =>
        error instanceof HostIntegrationError && error.code === 'timeout',
    );
  });

  void it('trata cancelamento do chamador como resultado desconhecido', async () => {
    const controller = new AbortController();
    const loading = service(hostReturning(neverResolves)).getAvailableTools({
      identity,
      conversationId,
      signal: controller.signal,
    });

    controller.abort();

    await assert.rejects(
      loading,
      (error: unknown) =>
        error instanceof HostIntegrationError &&
        error.code === 'unknown' &&
        /cancelado/.test(error.message),
    );
  });

  void it('envia ao Host apenas a identidade verificada pelo Core', async () => {
    const host = createFakeHost();

    await service(host).getAvailableTools({ identity, conversationId });

    assert.equal(host.context_requests.length, 1);
    assert.deepEqual(host.context_requests[0].principal, {
      user_id: 'user-123',
      tenant_id: 'tenant-123',
    });
    assert.equal(host.context_requests[0].conversation_id, conversationId);
  });

  void it('propaga o AbortSignal do chamador ao adaptador', async () => {
    let signal: AbortSignal | undefined;
    const host = hostReturning(async (request) => {
      signal = request.signal;
      return { chat_context: {}, tools: [] };
    });
    const controller = new AbortController();

    await service(host).getAvailableTools({
      identity,
      conversationId,
      signal: controller.signal,
    });
    controller.abort();

    assert.ok(signal);
    assert.equal(signal.aborted, true);
  });

  void it('catálogo vazio do Host é sucesso, não falha', async () => {
    const result = await service(createFakeHost()).getAvailableTools({
      identity,
      conversationId,
    });

    assert.deepEqual(result.tools, []);
    assert.deepEqual(result.discarded, {
      invalid_schema: 0,
      not_allowed: 0,
    });
  });

  void it('registra apenas contagens, sem nomes, schemas ou segredos', async () => {
    const secret = 'SEGREDO-NAO-LOGAR';
    const host = createFakeHost({
      chat_context: { permissions: ['customer.read'] },
      tools: [
        makeTool({
          name: 'ferramenta_secreta',
          description: secret,
          input_schema: {
            type: 'object',
            properties: { token: { type: 'string', description: secret } },
          },
        }),
      ],
    });
    const logs: string[] = [];
    const original = console.log;
    console.log = (...args: unknown[]) => {
      logs.push(args.join(' '));
    };

    try {
      await service(host).getAvailableTools({ identity, conversationId });
    } finally {
      console.log = original;
    }

    assert.ok(logs.some((line) => line.includes('catálogo')));
    assert.ok(logs.every((line) => !line.includes(secret)));
    assert.ok(logs.every((line) => !line.includes('ferramenta_secreta')));
  });

  void it('o módulo Nest resolve o serviço com o provider padrão sem Host', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [HostModule],
    }).compile();

    try {
      const catalog = moduleRef.get(HostToolCatalogService);

      await assert.rejects(
        catalog.getAvailableTools({ identity, conversationId }),
        (error: unknown) =>
          error instanceof HostIntegrationError &&
          error.code === 'host_unavailable',
      );
    } finally {
      await moduleRef.close();
    }
  });
});
