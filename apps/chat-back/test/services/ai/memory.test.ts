import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  injetarMemoriasNoContexto,
  recuperarMemoriaRelevante,
  renderizarMemoriasContexto,
} from '../../../src/services/ai/memory.js';
import type { AIContext } from '../../../src/services/ai/context.js';

function contextoBase(overrides: Partial<AIContext> = {}): AIContext {
  return {
    conversation_id: 'c1',
    state: 'idle',
    previous_messages: [],
    history_ids: [],
    max_context_messages: 20,
    ...overrides,
  };
}

describe('serviço de memória', () => {
  describe('recuperarMemoriaRelevante', () => {
    it('não lança exceção sem banco real configurado', async () => {
      const memórias = await recuperarMemoriaRelevante(
        'usuario-1',
        'qual linguagem uso no projeto?',
        5,
      );

      assert.ok(Array.isArray(memórias));
    });

    it('não retorna memórias para mensagem trivial', async () => {
      const memórias = await recuperarMemoriaRelevante('usuario-1', 'Oi', 5);
      assert.equal(memórias.length, 0);
    });
  });

  describe('injetarMemoriasNoContexto', () => {
    it('adiciona relevant_memories quando há memórias', () => {
      const contexto = contextoBase();
      const resultado = injetarMemoriasNoContexto(contexto, [
        {
          id: 'm1',
          content: 'O usuário programa em TypeScript.',
          category: 'projeto',
          importance: 3,
          context: null,
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ]);

      assert.ok(resultado.relevant_memories);
      assert.equal(resultado.relevant_memories!.length, 1);
      assert.equal(resultado.relevant_memories![0].category, 'projeto');
    });

    it('retorna o mesmo contexto sem alterar quando não há memórias', () => {
      const contexto = contextoBase();
      const resultado = injetarMemoriasNoContexto(contexto, []);
      assert.equal(resultado, contexto);
    });
  });

  describe('renderizarMemoriasContexto', () => {
    it('renderiza memórias como texto de instrução', () => {
      const texto = renderizarMemoriasContexto([
        {
          id: 'm1',
          content: 'O usuário programa em TypeScript.',
          category: 'projeto',
          importance: 3,
          context: null,
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ]);

      assert.ok(texto.includes('projeto'));
      assert.ok(texto.includes('TypeScript'));
    });

    it('retorna string vazia sem memórias', () => {
      assert.equal(renderizarMemoriasContexto([]), '');
    });
  });
});
