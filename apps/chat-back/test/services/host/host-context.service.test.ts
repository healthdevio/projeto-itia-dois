import 'reflect-metadata';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  HostIntegrationError,
  type HostContextRequest,
  type HostConversationContext,
  type HostIntegration,
} from '../../../src/models/host-integration.js';
import { DEFAULT_HOST_CONTEXT_LIMITS } from '../../../src/services/host/host-context.config.js';
import { HostContextService } from '../../../src/services/host/host-context.service.js';
import { createFakeHost } from '../../helpers/host-integration.fake.js';

const neverResolves = (): Promise<never> => new Promise<never>(() => undefined);

function service(host: HostIntegration, timeoutMs = 1000): HostContextService {
  return new HostContextService(host, DEFAULT_HOST_CONTEXT_LIMITS, timeoutMs);
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

void describe('HostContextService', () => {
  void it('monta o principal a partir da identidade verificada', async () => {
    const requests: HostContextRequest[] = [];
    const host = hostReturning(async (request) => {
      requests.push(request);
      return { chat_context: {}, tools: [] };
    });

    await service(host).load(
      { userId: 'user-123', tenantId: 'tenant-123' },
      'conversation-123',
    );

    assert.equal(requests.length, 1);
    assert.deepEqual(requests[0].principal, {
      user_id: 'user-123',
      tenant_id: 'tenant-123',
    });
    assert.equal(requests[0].conversation_id, 'conversation-123');
    assert.ok(requests[0].signal);
  });

  void it('omite tenant ausente em vez de enviar string vazia', async () => {
    let principal: HostContextRequest['principal'] | undefined;
    const host = hostReturning(async (request) => {
      principal = request.principal;
      return { chat_context: {}, tools: [] };
    });

    await service(host).load({ userId: 'user-123' }, 'conversation-123');

    assert.deepEqual(principal, { user_id: 'user-123' });
  });

  void it('devolve o contexto validado, inclusive ferramentas', async () => {
    const host = createFakeHost({
      chat_context: { permissions: ['customer.read'] },
      tools: [
        {
          name: 'buscar_cliente',
          description: 'Busca clientes.',
          required_permissions: ['customer.read'],
          input_schema: { type: 'object' },
        },
      ],
    });

    const result = await service(host).load(
      { userId: 'user-123' },
      'conversation-123',
    );

    assert.deepEqual(result.chat_context.permissions, ['customer.read']);
    assert.equal(result.tools[0].name, 'buscar_cliente');
  });

  void it('propaga os códigos tipados do contrato sem alterar a falha', async () => {
    for (const code of [
      'unauthorized',
      'forbidden',
      'host_unavailable',
    ] as const) {
      const host = createFakeHost({
        fail_with: new HostIntegrationError(code, 'falha do Host'),
      });

      await assert.rejects(
        service(host).load({ userId: 'user-123' }, 'conversation-123'),
        (error: unknown) =>
          error instanceof HostIntegrationError && error.code === code,
        code,
      );
    }
  });

  void it('converte falha não classificada em unknown', async () => {
    const host = hostReturning(async () => {
      throw new Error('sem classificação');
    });

    await assert.rejects(
      service(host).load({ userId: 'user-123' }, 'conversation-123'),
      (error: unknown) =>
        error instanceof HostIntegrationError &&
        error.code === 'unknown' &&
        error.message === 'Falha ao carregar o contexto do Host',
    );
  });

  void it('rejeita payload malformado do Host como unknown', async () => {
    const host = hostReturning(async () => {
      return {
        chat_context: 'não é objeto',
        tools: [],
      } as unknown as HostConversationContext;
    });

    await assert.rejects(
      service(host).load({ userId: 'user-123' }, 'conversation-123'),
      (error: unknown) =>
        error instanceof HostIntegrationError &&
        error.code === 'unknown' &&
        /Contexto do Host inválido/.test(error.message),
    );
  });

  void it('impõe timeout mesmo quando o adaptador ignora o sinal', async () => {
    const host = hostReturning(neverResolves);

    await assert.rejects(
      service(host, 20).load({ userId: 'user-123' }, 'conversation-123'),
      (error: unknown) =>
        error instanceof HostIntegrationError && error.code === 'timeout',
    );
  });

  void it('trata cancelamento do chamador como resultado desconhecido', async () => {
    const controller = new AbortController();
    const host = hostReturning(neverResolves);
    const loading = service(host).load(
      { userId: 'user-123' },
      'conversation-123',
      controller.signal,
    );

    controller.abort();

    await assert.rejects(
      loading,
      (error: unknown) =>
        error instanceof HostIntegrationError &&
        error.code === 'unknown' &&
        /cancelado/.test(error.message),
    );
  });

  void it('registra auditoria sem o conteúdo do contexto', async () => {
    const secret = 'conteúdo-sensível-do-host';
    const host = createFakeHost({
      chat_context: { system_context: secret },
      tools: [],
    });
    const logs: string[] = [];
    const original = console.log;
    console.log = (...args: unknown[]) => {
      logs.push(args.join(' '));
    };

    try {
      await service(host).load({ userId: 'user-123' }, 'conversation-123');
    } finally {
      console.log = original;
    }

    assert.ok(logs.some((line) => line.includes('contexto')));
    assert.ok(logs.some((line) => line.includes('user-123')));
    assert.ok(logs.every((line) => !line.includes(secret)));
  });
});
