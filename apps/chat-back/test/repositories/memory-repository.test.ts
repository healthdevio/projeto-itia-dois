import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  buscarMemoriasSimilares,
  createMemory,
  deleteMemory,
  findRelevantMemories,
  getMemory,
  listMemories,
  updateMemory,
  type Memory,
} from '../../src/repositories/memory-repository.js';

function linhaMemoria(parcial: Partial<Memory>): Memory {
  const base = new Date('2026-01-01T00:00:00.000Z');
  return {
    id: 'mem-1',
    userId: 'usuario-1',
    content: 'conteúdo de teste',
    category: 'geral',
    importance: 1,
    context: null,
    createdAt: base,
    updatedAt: base,
    ...parcial,
  };
}

/**
 * Banco simulado mínimo que encadeia os métodos do Drizzle usados pelo
 * repositório de memória, sem banco real. Os testes validam a lógica de
 * score, ordenação, limite e mapeamento do repositório.
 */
function bancoFake(linhas: Memory[] = []) {
  const store = linhas.map((m) => ({
    ...m,
    createdAt:
      m.createdAt instanceof Date ? m.createdAt : new Date(m.createdAt),
    updatedAt:
      m.updatedAt instanceof Date ? m.updatedAt : new Date(m.updatedAt),
  }));

  const ordem = () =>
    [...store].sort(
      (a, b) =>
        b.updatedAt.getTime() - a.updatedAt.getTime() ||
        b.createdAt.getTime() - a.createdAt.getTime(),
    );

  return {
    select() {
      return {
        from: () => ({
          where: () => ({
            orderBy: () => ({
              limit: (n: number) =>
                Promise.resolve(
                  ordem()
                    .map((m) => ({ ...m }))
                    .slice(0, n),
                ),
            }),
            limit: (n: number) =>
              Promise.resolve(
                ordem()
                  .map((m) => ({ ...m }))
                  .slice(0, n),
              ),
          }),
        }),
      };
    },
    insert() {
      return {
        values: (linha: Partial<Memory>) => {
          const agora = new Date();
          const nova: Memory = linhaMemoria({
            id: linha.id ?? `mem-${store.length + 1}`,
            userId: linha.userId ?? '',
            content: linha.content ?? '',
            category: linha.category ?? 'geral',
            importance: linha.importance ?? 1,
            context: linha.context ?? null,
            createdAt: agora,
            updatedAt: agora,
          });
          store.push(nova);
          return {
            returning() {
              return Promise.resolve([nova]);
            },
          };
        },
      };
    },
    update() {
      return {
        set: (campos: Record<string, unknown>) => {
          return {
            where: () => {
              return {
                returning() {
                  const indice = store.length > 0 ? 0 : -1;
                  if (indice === -1) return Promise.resolve([undefined]);
                  Object.assign(store[indice], {
                    ...store[indice],
                    ...campos,
                    updatedAt: new Date(),
                  });
                  return Promise.resolve([store[indice]]);
                },
              };
            },
          };
        },
      };
    },
    delete() {
      return {
        where: () => {
          const antes = store.length;
          store.splice(0, store.length);
          return { rowCount: antes };
        },
      };
    },
  } as unknown;
}

describe('memory-repository', () => {
  describe('createMemory', () => {
    it('cria uma memória com os campos informados', async () => {
      const db = bancoFake();
      const memoria = await createMemory(
        {
          userId: 'usuario-1',
          content: 'O usuário gosta de TypeScript.',
          category: 'preferencia',
          importance: 3,
        },
        db as any,
      );

      assert.equal(memoria.userId, 'usuario-1');
      assert.equal(memoria.content, 'O usuário gosta de TypeScript.');
      assert.equal(memoria.category, 'preferencia');
      assert.equal(memoria.importance, 3);
      assert.ok(memoria.id);
    });
  });

  describe('listMemories', () => {
    it('ordena da mais recente para a mais antiga', async () => {
      const db = bancoFake([
        linhaMemoria({
          id: 'a',
          content: 'mais antiga',
          updatedAt: new Date('2026-01-01T00:00:00.000Z'),
        }),
        linhaMemoria({
          id: 'b',
          content: 'mais recente',
          updatedAt: new Date('2026-02-01T00:00:00.000Z'),
        }),
      ]);

      const todas = await listMemories('usuario-1', db as any);

      assert.equal(todas.length, 2);
      assert.equal(todas[0].content, 'mais recente');
      assert.equal(todas[1].content, 'mais antiga');
    });
  });

  describe('getMemory', () => {
    it('retorna a memória quando encontrada', async () => {
      const db = bancoFake([
        linhaMemoria({ id: 'mem-x', userId: 'usuario-1' }),
      ]);

      const memoria = await getMemory('mem-x', 'usuario-1', db as any);

      assert.ok(memoria);
      assert.equal(memoria!.id, 'mem-x');
    });

    it('retorna null quando não existe', async () => {
      const db = bancoFake();
      const memoria = await getMemory('inexistente', 'usuario-1', db as any);

      assert.equal(memoria, null);
    });
  });

  describe('updateMemory', () => {
    it('atualiza campos informados e preserva os demais', async () => {
      const db = bancoFake([
        linhaMemoria({
          id: 'mem-x',
          content: 'conteúdo original',
          category: 'geral',
          importance: 1,
        }),
      ]);

      const atualizada = await updateMemory(
        'mem-x',
        'usuario-1',
        { content: 'conteúdo atualizado', importance: 4 },
        db as any,
      );

      assert.ok(atualizada);
      assert.equal(atualizada!.content, 'conteúdo atualizado');
      assert.equal(atualizada!.category, 'geral');
      assert.equal(atualizada!.importance, 4);
    });

    it('retorna null quando não existe', async () => {
      const db = bancoFake();
      const atualizada = await updateMemory(
        'mem-x',
        'usuario-1',
        { content: 'x' },
        db as any,
      );

      assert.equal(atualizada, null);
    });
  });

  describe('buscarMemoriasSimilares', () => {
    it('encontra memórias que contenham as palavras do conteúdo', async () => {
      const db = bancoFake([
        linhaMemoria({
          content: 'O usuário está desenvolvendo um projeto em TypeScript.',
        }),
        linhaMemoria({ content: 'Prefere comida italiana.' }),
      ]);

      const similares = await buscarMemoriasSimilares(
        'usuario-1',
        'projeto TypeScript',
        10,
        db as any,
      );

      assert.ok(similares.length >= 1);
      assert.ok(similares.some((s) => s.content.includes('TypeScript')));
    });
  });

  describe('findRelevantMemories', () => {
    it('recupera memórias que compartilham palavras com a mensagem', async () => {
      const db = bancoFake([
        linhaMemoria({ content: 'O usuário programa em TypeScript.' }),
        linhaMemoria({ content: 'Gosta de pizza.' }),
      ]);

      const relevantes = await findRelevantMemories(
        'usuario-1',
        'programação TypeScript',
        5,
        db as any,
      );

      assert.equal(relevantes.length, 1);
      assert.ok(relevantes[0]!.content.includes('TypeScript'));
    });

    it('respeita o limite de memórias', async () => {
      const db = bancoFake(
        Array.from({ length: 10 }, (_, i) =>
          linhaMemoria({
            id: `mem-${i}`,
            content: `memória sobre programação ${i}`,
          }),
        ),
      );

      const relevantes = await findRelevantMemories(
        'usuario-1',
        'programação',
        3,
        db as any,
      );

      assert.equal(relevantes.length, 3);
    });

    it('não retorna memórias para mensagem trivial', async () => {
      const db = bancoFake([linhaMemoria({ content: 'qualquer coisa' })]);

      const relevantes = await findRelevantMemories(
        'usuario-1',
        'Oi',
        5,
        db as any,
      );

      assert.equal(relevantes.length, 0);
    });
  });

  describe('deleteMemory', () => {
    it('remove a memória', async () => {
      const db = bancoFake([
        linhaMemoria({ id: 'mem-x', userId: 'usuario-1' }),
      ]);

      const removido = await deleteMemory('mem-x', 'usuario-1', db as any);
      const aindaExiste = await getMemory('mem-x', 'usuario-1', db as any);

      assert.ok(removido);
      assert.equal(aindaExiste, null);
    });
  });
});
