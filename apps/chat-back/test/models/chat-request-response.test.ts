import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { DEFAULT_CHAT_CONFIG } from '../../src/models/chat-config.js';
import { validateChatRequest } from '../../src/models/chat-request.js';
import { validateChatResponse } from '../../src/models/chat-response.js';

void describe('validateChatRequest', () => {
  void it('valida payload mínimo válido e aplica DEFAULT_CHAT_CONFIG', () => {
    const result = validateChatRequest({
      request_id: '  req-10  ',
      message_id: '  msg-10  ',
      message: '  Oi Omnia  ',
      origin: '  web  ',
    });

    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.data.request_id, 'req-10');
      assert.equal(result.data.message_id, 'msg-10');
      assert.equal(result.data.message, 'Oi Omnia');
      assert.equal(result.data.origin, 'web');
      assert.deepEqual(result.data.config, DEFAULT_CHAT_CONFIG);
    }
  });

  void it('rejeita request_id ausente ou vazio', () => {
    const result = validateChatRequest({
      request_id: '   ',
      message_id: 'msg-10',
      message: 'Oi Omnia',
      origin: 'web',
    });

    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.ok(result.issues.some((issue) => issue.path === 'request_id'));
    }
  });

  void it('rejeita config com campo inválido', () => {
    const result = validateChatRequest({
      request_id: 'req-10',
      message_id: 'msg-10',
      message: 'Oi Omnia',
      origin: 'web',
      config: { response_length: 'gigante' },
    });

    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.ok(
        result.issues.some((issue) => issue.path === 'config.response_length'),
      );
    }
  });
});

void describe('validateChatResponse', () => {
  void it('valida ChatResponse completo', () => {
    const result = validateChatResponse({
      request_id: 'req-10',
      conversation_id: 'conv-1',
      message_id: 'msg-10',
      ai_response: 'Resposta pronta',
      state: 'success',
      suggestions: [{ suggestion_id: 'sg-1', text: 'Próximo passo' }],
      config: DEFAULT_CHAT_CONFIG,
    });

    assert.equal(result.ok, true);
  });

  void it('rejeita ChatResponse com request_id vazio ou state inválido', () => {
    const result = validateChatResponse({
      request_id: '',
      conversation_id: 'conv-1',
      message_id: 'msg-10',
      ai_response: 'Resposta pronta',
      state: 'idle',
      suggestions: [],
      config: DEFAULT_CHAT_CONFIG,
    });

    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.ok(result.issues.some((issue) => issue.path === 'request_id'));
    }
  });
});
