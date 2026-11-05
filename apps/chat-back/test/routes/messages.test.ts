import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';

import type { INestApplication } from '@nestjs/common';
import request from 'supertest';

import { authorizationHeaders } from '../helpers/identity.js';
import { createTestApp } from '../helpers/nest-app.js';

// Cobre o que a rota decide antes de gravar e chamar a AI. O resto depende do
// Postgres e fica para o smoke test (`npm run smoke`).
let app: INestApplication;

before(async () => {
  app = await createTestApp();
});

after(async () => {
  await app.close();
});

async function post(body: unknown, headers: Record<string, string> = {}) {
  const auth = await authorizationHeaders();
  let callback = request(app.getHttpServer())
    .post('/api/messages')
    .set('Content-Type', 'application/json');

  for (const [name, value] of Object.entries({ ...auth, ...headers })) {
    callback = callback.set(name, value);
  }

  return callback.send(typeof body === 'string' ? body : JSON.stringify(body));
}

const validBody = {
  message_id: 'msg-1',
  message: 'Olá',
  origin: 'frontend',
};

describe('POST /api/messages · identidade', () => {
  it('responde 401 sem token Bearer', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/messages')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify(validBody));

    assert.equal(response.status, 401);
    assert.equal(response.body.success, false);
    assert.match(response.body.error, /Bearer/);
  });

  it('responde 401 para subject malformado, antes de tocar no banco', async () => {
    const auth = await authorizationHeaders('usuário com espaço');
    const response = await request(app.getHttpServer())
      .post('/api/messages')
      .set('Content-Type', 'application/json')
      .set('Authorization', auth.Authorization)
      .send(JSON.stringify(validBody));

    assert.equal(response.status, 401);
  });

  it('não exige tenant: ausente, usa o prompt padrão', async () => {
    // Sem `DATABASE_URL` a rota falha no banco, não na identidade.
    const response = await post(validBody);

    assert.notEqual(response.status, 401);
  });
});

describe('POST /api/messages · corpo', () => {
  it('responde 400 para JSON inválido', async () => {
    const response = await post('{ nao é json');

    assert.equal(response.status, 400);
  });

  it('responde 400 para JSON que não é objeto', async () => {
    for (const body of ['[]', 'null', '"texto"', '42']) {
      const response = await post(body);

      assert.equal(response.status, 400, body);
    }
  });

  it('responde 400 listando os campos obrigatórios', async () => {
    const response = await post({ message: 'Olá' });

    assert.equal(response.status, 400);
    assert.equal(response.body.success, false);
    for (const field of ['message_id', 'message', 'origin']) {
      assert.match(response.body.error, new RegExp(field));
    }
  });
});

describe('POST /api/messages · config', () => {
  it('recusa config inválido antes de gravar a mensagem', async () => {
    const response = await post({
      ...validBody,
      config: { tone: 'sarcastico' },
    });

    assert.equal(response.status, 400);
    assert.match(
      response.body.error,
      /config\.tone deve ser um de: formal, neutral, informal/,
    );
  });

  it('diz o que era válido, para a interface corrigir o campo', async () => {
    const response = await post({
      ...validBody,
      config: { language: 'fr-FR' },
    });

    assert.equal(response.status, 400);
    assert.match(response.body.error, /config\.language deve ser um de/);
  });

  it('recusa config que não é objeto', async () => {
    const response = await post({ ...validBody, config: 'formal' });

    assert.equal(response.status, 400);
    assert.match(response.body.error, /config deve ser um objeto/);
  });

  it('prefere o erro de config ao de campo faltando', async () => {
    // Sem esta ordem, a interface corrigiria o campo errado primeiro.
    const response = await post({
      message: 'Olá',
      config: { tone: 'sarcastico' },
    });

    assert.equal(response.status, 400);
    assert.match(response.body.error, /config\.tone/);
  });
});
