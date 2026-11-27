import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { DEFAULT_CHAT_CONFIG } from '../../src/models/chat-config.js';
import {
  buildSafeSseErrorEvent,
  validateSseEvent,
} from '../../src/models/sse-events.js';
import { SseEventValidatorService } from '../../src/services/sse-event-validator.service.js';

const meta = {
  request_id: 'req-1',
  conversation_id: 'conv-1',
  message_id: 'msg-1',
};

void describe('validateSseEvent', () => {
  void it('aceita eventos válidos dos 4 tipos do contrato', () => {
    const started = validateSseEvent({
      event: 'message.started',
      data: { ...meta, state: 'streaming' },
    });
    assert.equal(started.ok, true);

    const delta = validateSseEvent({
      event: 'message.delta',
      data: { ...meta, delta: 'Olá' },
    });
    assert.equal(delta.ok, true);

    const completed = validateSseEvent({
      event: 'message.completed',
      data: {
        ...meta,
        state: 'success',
        suggestions: [{ suggestion_id: 'sg-1', text: 'Continuar' }],
        config: DEFAULT_CHAT_CONFIG,
      },
    });
    assert.equal(completed.ok, true);

    const errEvent = validateSseEvent({
      event: 'message.error',
      data: { ...meta, state: 'error', error: 'Falha controlada' },
    });
    assert.equal(errEvent.ok, true);
  });

  void it('rejeita evento com estado incompatível ou campo obrigatório ausente', () => {
    const invalidState = validateSseEvent({
      event: 'message.started',
      data: { ...meta, state: 'success' },
    });
    assert.equal(invalidState.ok, false);

    const missingRequestId = validateSseEvent({
      event: 'message.delta',
      data: {
        request_id: '',
        conversation_id: 'conv-1',
        message_id: 'msg-1',
        delta: 'Oi',
      },
    });
    assert.equal(missingRequestId.ok, false);
  });
});

void describe('buildSafeSseErrorEvent e SseEventValidatorService', () => {
  void it('gera evento message.error válido sem vazar detalhes internos', () => {
    const safeEvent = buildSafeSseErrorEvent(
      meta,
      'Erro interno ao transmitir resposta',
    );
    const check = validateSseEvent(safeEvent);

    assert.equal(check.ok, true);
    if (check.ok && check.data.event === 'message.error') {
      assert.equal(check.data.data.state, 'error');
      assert.equal(
        check.data.data.error,
        'Erro interno ao transmitir resposta',
      );
    }
  });

  void it('converte evento inválido ou falha de stream em ação error segura', () => {
    const service = new SseEventValidatorService();

    const invalidDecision = service.validateOutgoing(
      { event: 'message.started', data: { ...meta, state: 'idle' } },
      meta,
    );
    assert.equal(invalidDecision.action, 'error');
    assert.equal(invalidDecision.event.event, 'message.error');

    const failureDecision = service.handleStreamFailure(
      new Error('detalhe sensível da conexão'),
      meta,
    );
    assert.equal(failureDecision.action, 'error');
    assert.equal(failureDecision.event.event, 'message.error');
    if (failureDecision.event.event === 'message.error') {
      assert.doesNotMatch(failureDecision.event.data.error, /detalhe sensível/);
    }
  });
});
