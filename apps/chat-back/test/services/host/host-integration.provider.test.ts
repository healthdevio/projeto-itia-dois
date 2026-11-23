import 'reflect-metadata';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { Test } from '@nestjs/testing';

import {
  HostIntegrationError,
  type HostToolExecutionRequest,
} from '../../../src/models/host-integration.js';
import { HostContextService } from '../../../src/services/host/host-context.service.js';
import { createUnconfiguredHostIntegration } from '../../../src/services/host/host-integration.provider.js';
import { HostModule } from '../../../src/services/host/host.module.js';

const toolCall: HostToolExecutionRequest = {
  principal: { user_id: 'user-123' },
  tool_call: {
    id: 'call-123',
    tool_name: 'buscar_cliente',
    arguments: {},
    context: { conversation_id: 'conversation-123' },
  },
};

void describe('provider padrão da integração com o Host', () => {
  void it('recusa contexto com host_unavailable em vez de devolver vazio', async () => {
    const host = createUnconfiguredHostIntegration();

    await assert.rejects(
      host.loadConversationContext({
        principal: { user_id: 'user-123' },
        conversation_id: 'conversation-123',
      }),
      (error: unknown) =>
        error instanceof HostIntegrationError &&
        error.code === 'host_unavailable',
    );
  });

  void it('recusa execução de ferramenta com host_unavailable', async () => {
    const host = createUnconfiguredHostIntegration();

    await assert.rejects(
      host.executeTool(toolCall),
      (error: unknown) =>
        error instanceof HostIntegrationError &&
        error.code === 'host_unavailable',
    );
  });

  void it('o módulo resolve o serviço e mantém a falha explícita', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [HostModule],
    }).compile();

    try {
      const service = moduleRef.get(HostContextService);

      await assert.rejects(
        service.load({ userId: 'user-123' }, 'conversation-123'),
        (error: unknown) =>
          error instanceof HostIntegrationError &&
          error.code === 'host_unavailable',
      );
    } finally {
      await moduleRef.close();
    }
  });
});
