import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  MAX_SUGGESTIONS,
  MAX_SUGGESTION_TEXT_LENGTH,
  readSuggestions,
  validateSuggestions,
} from '../../src/models/suggestion.js';

describe('readSuggestions', () => {
  it('lê a string solta como sugestão com o próprio texto', () => {
    const suggestions = readSuggestions(['Ver meus detalhes']);

    assert.equal(suggestions.length, 1);
    assert.equal(suggestions[0].text, 'Ver meus detalhes');
    assert.match(suggestions[0].suggestion_id, /^sg-/);
  });

  it('preserva o id que a AI mandou', () => {
    const [suggestion] = readSuggestions([
      { suggestion_id: 'sg-1', text: 'Falar com o suporte' },
    ]);

    assert.equal(suggestion.suggestion_id, 'sg-1');
  });

  it('gera id novo quando o da AI é longo demais', () => {
    const [suggestion] = readSuggestions([
      { suggestion_id: 'x'.repeat(5000), text: 'abc' },
    ]);

    assert.match(suggestion.suggestion_id, /^sg-/);
  });

  it('descarta entrada malformada sem derrubar a lista', () => {
    const suggestions = readSuggestions([
      'ok',
      null,
      42,
      { text: '   ' },
      { naoTemTexto: true },
      'também ok',
    ]);

    assert.deepEqual(
      suggestions.map((s) => s.text),
      ['ok', 'também ok'],
    );
  });

  it('corta no limite, preservando a ordem', () => {
    const suggestions = readSuggestions(
      Array.from({ length: MAX_SUGGESTIONS + 5 }, (_, i) => `s${i}`),
    );

    assert.equal(suggestions.length, MAX_SUGGESTIONS);
    assert.equal(suggestions[0].text, 's0');
    assert.equal(
      suggestions[MAX_SUGGESTIONS - 1].text,
      `s${MAX_SUGGESTIONS - 1}`,
    );
  });

  it('devolve lista vazia para o que não é array', () => {
    for (const value of [undefined, null, 'abc', { text: 'abc' }]) {
      assert.deepEqual(readSuggestions(value), []);
    }
  });
});

describe('validateSuggestions', () => {
  it('aceita uma lista de objetos', () => {
    const result = validateSuggestions({
      suggestions: [{ text: 'abc' }, { suggestion_id: 'sg-9', text: 'def' }],
    });

    assert.equal(result.ok, true);
    assert.equal(result.ok && result.suggestions.length, 2);
  });

  it('aceita uma lista de strings', () => {
    const result = validateSuggestions({ suggestions: ['abc'] });

    assert.equal(result.ok, true);
    assert.equal(result.ok && result.suggestions[0].text, 'abc');
  });

  it('aceita sugestão solta com { text }', () => {
    const result = validateSuggestions({ text: 'abc' });

    assert.equal(result.ok, true);
    assert.equal(result.ok && result.suggestions.length, 1);
  });

  it('recusa lista vazia', () => {
    const result = validateSuggestions({ suggestions: [] });

    assert.equal(result.ok, false);
    assert.match(result.ok ? '' : result.error, /vazia/);
  });

  it('recusa lista acima do limite', () => {
    const result = validateSuggestions({
      suggestions: Array.from({ length: MAX_SUGGESTIONS + 1 }, () => 'abc'),
    });

    assert.equal(result.ok, false);
    assert.match(result.ok ? '' : result.error, /No máximo/);
  });

  it('recusa corpo sem suggestions nem text', () => {
    assert.equal(validateSuggestions({}).ok, false);
    assert.equal(validateSuggestions(null).ok, false);
  });

  it('aponta o índice do item inválido, não o da lista', () => {
    const result = validateSuggestions({ suggestions: ['ok', 'ok', 42] });

    assert.equal(result.ok, false);
    assert.match(result.ok ? '' : result.error, /suggestions\[2\]/);
  });

  it('recusa text acima do limite de caracteres', () => {
    const result = validateSuggestions({
      text: 'x'.repeat(MAX_SUGGESTION_TEXT_LENGTH + 1),
    });

    assert.equal(result.ok, false);
  });
});
