import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { Hono } from 'hono';

import { suggestionRoutes } from '../../src/routes/suggestions.js';
import { conversationRoutes } from '../../src/routes/conversations.js';
import { USER_ID_HEADER } from '../../src/middleware/identity.js';

// Identidade e validação de corpo, sem tocar o banco. O caminho de sucesso
// fica para o smoke test (`npm run smoke`).
function app() {
  const instance = new Hono();

  instance.route('/api/suggestions', suggestionRoutes);
  instance.route('/api/conversations', conversationRoutes);

  return instance;
}

// `userId: null` sai sem o header, que é o caso a exercitar.
function send(
  path: string,
  init: RequestInit & { userId?: string | null } = {},
) {
  const { userId = 'ana', ...rest } = init;

  return app().request(path, {
    ...rest,
    headers: {
      'Content-Type': 'application/json',
      ...(userId === null ? {} : { [USER_ID_HEADER]: userId }),
      ...(rest.headers as Record<string, string>),
    },
  });
}

describe('rotas exigem identidade antes de qualquer acesso ao banco', () => {
  const rotas: [string, string][] = [
    ['GET', '/api/suggestions'],
    ['POST', '/api/suggestions'],
    ['DELETE', '/api/suggestions'],
    ['GET', '/api/conversations/current'],
    ['GET', '/api/conversations/active'],
    ['POST', '/api/conversations/rotate'],
  ];

  for (const [method, path] of rotas) {
    it(`${method} ${path} responde 401 sem X-User-Id`, async () => {
      const response = await send(path, {
        method,
        userId: null,
        ...(method === 'POST' ? { body: JSON.stringify({ text: 'abc' }) } : {}),
      });

      assert.equal(response.status, 401);

      const body = await response.json();

      assert.equal(body.success, false);
      assert.match(body.error, new RegExp(USER_ID_HEADER));
    });
  }
});

describe('POST /api/suggestions · corpo', () => {
  it('responde 400 para JSON inválido', async () => {
    const response = await send('/api/suggestions', {
      method: 'POST',
      body: '{ nao é json',
    });

    assert.equal(response.status, 400);
    assert.match((await response.json()).error, /JSON inválido/);
  });

  it('responde 400 para corpo sem suggestions nem text', async () => {
    const response = await send('/api/suggestions', {
      method: 'POST',
      body: JSON.stringify({}),
    });

    assert.equal(response.status, 400);
    assert.match((await response.json()).error, /obrigatório/i);
  });

  it('responde 400 para lista vazia', async () => {
    const response = await send('/api/suggestions', {
      method: 'POST',
      body: JSON.stringify({ suggestions: [] }),
    });

    assert.equal(response.status, 400);
    assert.match((await response.json()).error, /vazia/);
  });

  it('valida o corpo antes de gravar', async () => {
    // Sem `DATABASE_URL`, validação que passasse apareceria como 500.
    const response = await send('/api/suggestions', {
      method: 'POST',
      body: JSON.stringify({ suggestions: ['ok', 42] }),
    });

    assert.equal(response.status, 400);
    assert.match((await response.json()).error, /suggestions\[1\]/);
  });
});
