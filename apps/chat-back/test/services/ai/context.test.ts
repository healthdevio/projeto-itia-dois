import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  buildContext,
  DEFAULT_CONTEXT_WINDOW,
} from '../../../src/services/ai/context.js';
import type { ConversationMessage } from '../../../src/models/conversation.js';

function message(index: number): ConversationMessage {
  return {
    message_id: `m${index}`,
    message: `mensagem ${index}`,
    origin: 'frontend',
    role: 'user',
  };
}

const history = Array.from({ length: 50 }, (_, i) => message(i));

describe('buildContext', () => {
  it('leva a conversa, o estado e os ids do histórico', () => {
    const context = buildContext('c1', 'idle', [], ['h1', 'h2']);

    assert.equal(context.conversation_id, 'c1');
    assert.equal(context.state, 'idle');
    assert.deepEqual(context.previous_messages, []);
    assert.deepEqual(context.history_ids, ['h1', 'h2']);
  });

  it('corta na janela padrão', () => {
    const context = buildContext('c1', 'idle', history, []);

    assert.equal(context.max_context_messages, DEFAULT_CONTEXT_WINDOW);
    assert.equal(context.previous_messages.length, DEFAULT_CONTEXT_WINDOW);
  });

  it('mantém as mensagens mais recentes, que são as relevantes', () => {
    const context = buildContext('c1', 'idle', history, []);

    assert.deepEqual(
      context.previous_messages.at(-1),
      message(history.length - 1),
    );
    assert.equal(context.previous_messages[0].message, `mensagem 30`);
  });

  it('respeita a janela informada', () => {
    const context = buildContext('c1', 'idle', history, [], 3);

    assert.deepEqual(
      context.previous_messages.map((m) => m.message),
      ['mensagem 47', 'mensagem 48', 'mensagem 49'],
    );
  });

  it('não duplica a lista recebida, para quem chamou poder seguir mutando', () => {
    const context = buildContext('c1', 'idle', history, []);

    assert.notEqual(context.previous_messages, history);
  });

  it('copia a lista de ids do histórico', () => {
    const ids = ['h1'];
    const context = buildContext('c1', 'idle', [], ids);

    assert.notEqual(context.history_ids, ids);
    assert.deepEqual(context.history_ids, ids);
  });
});
