import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  canTransition,
  isConversationState,
  normalizeConversationState,
  type ConversationState,
} from '../../src/models/conversation-state.js';

describe('canTransition', () => {
  it('permite a troca que o ciclo do chat faz', () => {
    const happyPath: [ConversationState, ConversationState][] = [
      ['idle', 'streaming'],
      ['streaming', 'success'],
      ['success', 'streaming'],
    ];

    for (const [from, to] of happyPath) {
      assert.equal(canTransition(from, to), true, `${from} -> ${to}`);
    }
  });

  it('deixa qualquer estado cair em error', () => {
    for (const from of ['idle', 'streaming', 'success', 'error'] as const) {
      assert.equal(canTransition(from, 'error'), true, `${from} -> error`);
    }
  });

  it('só permite sair de error para retry ou para uma conversa parada', () => {
    assert.equal(canTransition('error', 'streaming'), true);
    assert.equal(canTransition('error', 'idle'), true);
    assert.equal(canTransition('error', 'success'), false);
  });

  it('recusa pular de idle direto para success', () => {
    assert.equal(canTransition('idle', 'success'), false);
  });

  it('recusa voltar de success para idle', () => {
    assert.equal(canTransition('success', 'idle'), false);
  });

  it('trata stay no mesmo estado como permitido', () => {
    for (const state of ['idle', 'streaming', 'success', 'error'] as const) {
      assert.equal(canTransition(state, state), true, state);
    }
  });
});

describe('normalizeConversationState', () => {
  it('mantém os estados da máquina atual', () => {
    for (const state of ['idle', 'streaming', 'success', 'error'] as const) {
      assert.equal(normalizeConversationState(state), state);
    }
  });

  it('mapeia os estados antigos para o equivalente atual', () => {
    assert.equal(normalizeConversationState('greeting'), 'idle');
    assert.equal(normalizeConversationState('thinking'), 'streaming');
  });

  it('cai em idle, sem presumir nada, quando o estado é desconhecido', () => {
    assert.equal(normalizeConversationState('nao_existe'), 'idle');
    assert.equal(normalizeConversationState(null), 'idle');
    assert.equal(normalizeConversationState(42), 'idle');
  });
});

describe('isConversationState', () => {
  it('reconhece só os quatro estados', () => {
    assert.equal(isConversationState('idle'), true);
    assert.equal(isConversationState('greeting'), false);
    assert.equal(isConversationState(undefined), false);
  });
});
