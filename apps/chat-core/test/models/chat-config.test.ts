import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  DEFAULT_CHAT_CONFIG,
  formatChatConfig,
  validateChatConfig,
} from '../../src/models/chat-config.js';

describe('validateChatConfig', () => {
  it('completa com o default quando o config não vem', () => {
    for (const value of [undefined, null]) {
      const result = validateChatConfig(value);

      assert.equal(result.ok, true);
      assert.deepEqual(result.ok && result.config, DEFAULT_CHAT_CONFIG);
    }
  });

  it('aceita um config completo', () => {
    const result = validateChatConfig({
      language: 'en-US',
      tone: 'formal',
      response_length: 'detailed',
    });

    assert.equal(result.ok, true);
    assert.deepEqual(result.ok && result.config, {
      language: 'en-US',
      tone: 'formal',
      response_length: 'detailed',
    });
  });

  it('preenche só o campo que faltou', () => {
    const result = validateChatConfig({ tone: 'informal' });

    assert.equal(result.ok, true);
    assert.deepEqual(result.ok && result.config, {
      ...DEFAULT_CHAT_CONFIG,
      tone: 'informal',
    });
  });

  it('ignora chave que o Core não conhece', () => {
    const result = validateChatConfig({ tone: 'formal', future_field: 'x' });

    assert.equal(result.ok, true);
    assert.equal(result.ok && result.config.tone, 'formal');
  });

  it('recusa valor fora da lista, dizendo o que era válido', () => {
    const result = validateChatConfig({ tone: 'sarcastico' });

    assert.equal(result.ok, false);
    assert.match(
      result.ok ? '' : result.error,
      /config\.tone deve ser um de: formal, neutral, informal/,
    );
  });

  it('recusa config que não é objeto', () => {
    for (const value of ['formal', 42, ['formal']]) {
      assert.equal(validateChatConfig(value).ok, false);
    }
  });

  it('não devolve o default compartilhado, para o chamador não mutar o módulo', () => {
    const first = validateChatConfig(undefined);
    const second = validateChatConfig(undefined);

    assert.notEqual(first.ok && first.config, second.ok && second.config);
  });
});

describe('formatChatConfig', () => {
  it('resume os três campos, separando por um separador fixo', () => {
    const summary = formatChatConfig({
      language: 'pt-BR',
      tone: 'neutral',
      response_length: 'standard',
    });

    assert.match(summary, /pt-BR/);
    assert.match(summary, /neutral/);
    assert.match(summary, /standard/);
    // Um separador só entre os campos, para o log de rota e o do provider
    // mostrarem a mesma linha.
    assert.equal(summary.split(' · ').length, 3);
  });
});
