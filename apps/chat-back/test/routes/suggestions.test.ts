import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';

import type { INestApplication } from '@nestjs/common';
import request from 'supertest';

import { authorizationHeaders } from '../helpers/identity.js';
import { createTestApp } from '../helpers/nest-app.js';

// Identidade e validação de corpo, sem tocar o banco. O caminho de sucesso
// fica para o smoke test (`npm run smoke`).
let app: INestApplication;

before(async () => {
  app = await createTestApp();
});

after(async () => {
  await app.close();
});

type Method = 'get' | 'post' | 'delete';

interface SendOptions {
  method?: Method;
  subject?: string | null;
  body?: string;
  headers?: Record<string, string>;
}

// `subject: null` omite o token Bearer, que é o caso a exercitar.
async function send(path: string, init: SendOptions = {}) {
  const { method = 'get', subject = 'ana', body, headers = {} } = init;

  let callback = request(app.getHttpServer())
    [method](path)
    .set('Content-Type', 'application/json');

  if (subject !== null) {
    const auth = await authorizationHeaders(subject);

    callback = callback.set('Authorization', auth.Authorization);
  }

  for (const [name, value] of Object.entries(headers)) {
    callback = callback.set(name, value);
  }

  return body === undefined ? callback : callback.send(body);
}

describe('rotas exigem identidade antes de qualquer acesso ao banco', () => {
  const rotas: [Method, string][] = [
    ['get', '/api/suggestions'],
    ['post', '/api/suggestions'],
    ['delete', '/api/suggestions'],
    ['get', '/api/conversations/current'],
    ['get', '/api/conversations/active'],
    ['post', '/api/conversations/rotate'],
  ];

  for (const [method, path] of rotas) {
    it(`${method.toUpperCase()} ${path} responde 401 sem token Bearer`, async () => {
      const response = await send(path, {
        method,
        subject: null,
        ...(method === 'post' ? { body: JSON.stringify({ text: 'abc' }) } : {}),
      });

      assert.equal(response.status, 401);
      assert.equal(response.body.success, false);
      assert.match(response.body.error, /Bearer/);
    });
  }
});

describe('POST /api/suggestions · corpo', () => {
  it('responde 400 para JSON inválido', async () => {
    const response = await send('/api/suggestions', {
      method: 'post',
      body: '{ nao é json',
    });

    assert.equal(response.status, 400);
  });

  it('responde 400 para corpo sem suggestions nem text', async () => {
    const response = await send('/api/suggestions', {
      method: 'post',
      body: JSON.stringify({}),
    });

    assert.equal(response.status, 400);
    assert.match(response.body.error, /obrigatório/i);
  });

  it('responde 400 para lista vazia', async () => {
    const response = await send('/api/suggestions', {
      method: 'post',
      body: JSON.stringify({ suggestions: [] }),
    });

    assert.equal(response.status, 400);
    assert.match(response.body.error, /vazia/);
  });

  it('valida o corpo antes de gravar', async () => {
    // Sem `DATABASE_URL`, validação que passasse apareceria como 500.
    const response = await send('/api/suggestions', {
      method: 'post',
      body: JSON.stringify({ suggestions: ['ok', 42] }),
    });

    assert.equal(response.status, 400);
    assert.match(response.body.error, /suggestions\[1\]/);
  });
});
