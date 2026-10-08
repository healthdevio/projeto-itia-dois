import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { Hono } from 'hono';

import { messageRoutes } from '../../src/routes/messages.js';
import { USER_ID_HEADER } from '../../src/middleware/identity.js';

// Cobre o que a rota decide antes de gravar e chamar a AI. O resto depende do
// Postgres e fica para o smoke test (`npm run smoke`).
function app() {
  const instance = new Hono();

  instance.route('/api/messages', messageRoutes);

  return instance;
}

function post(body: unknown, headers: Record<string, string> = {}) {
  return app().request('/api/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      [USER_ID_HEADER]: 'ana',
      ...headers,
    },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

const validBody = {
  message_id: 'msg-1',
  message: 'Olá',
  origin: 'frontend',
};

describe('POST /api/messages · identidade', () => {
  it('responde 401 sem o header de usuário', async () => {
    const response = await app().request('/api/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validBody),
    });

    assert.equal(response.status, 401);

    const body = await response.json();

    assert.equal(body.success, false);
    assert.match(body.error, new RegExp(USER_ID_HEADER));
  });

  it('responde 401 para user id malformado, antes de tocar no banco', async () => {
    const response = await post(validBody, {
      [USER_ID_HEADER]: 'usuário com espaço',
    });

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
    assert.match((await response.json()).error, /JSON inválido/);
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

    const body = await response.json();

    assert.equal(body.success, false);
    for (const field of ['message_id', 'message', 'origin']) {
      assert.match(body.error, new RegExp(field));
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
      (await response.json()).error,
      /config\.tone deve ser um de: formal, neutral, informal/,
    );
  });

  it('diz o que era válido, para a interface corrigir o campo', async () => {
    const response = await post({
      ...validBody,
      config: { language: 'fr-FR' },
    });

    assert.equal(response.status, 400);
    assert.match(
      (await response.json()).error,
      /config\.language deve ser um de/,
    );
  });

  it('recusa config que não é objeto', async () => {
    const response = await post({ ...validBody, config: 'formal' });

    assert.equal(response.status, 400);
    assert.match((await response.json()).error, /config deve ser um objeto/);
  });

  it('prefere o erro de config ao de campo faltando', async () => {
    // Sem esta ordem, a interface corrigiria o campo errado primeiro.
    const response = await post({
      message: 'Olá',
      config: { tone: 'sarcastico' },
    });

    assert.equal(response.status, 400);
    assert.match((await response.json()).error, /config\.tone/);
  });
});
