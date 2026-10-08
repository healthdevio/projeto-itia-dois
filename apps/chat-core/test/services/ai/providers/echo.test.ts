import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { createEchoProvider } from '../../../../src/services/ai/providers/echo.js';
import {
  DEFAULT_CHAT_CONFIG,
  type ChatConfig,
} from '../../../../src/models/chat-config.js';
import type { AIContext } from '../../../../src/services/ai/context.js';

const context: AIContext = {
  conversation_id: 'c1',
  state: 'idle',
  previous_messages: [],
  history_ids: [],
  max_context_messages: 20,
};

function respond(config: ChatConfig = DEFAULT_CHAT_CONFIG, env = {}) {
  const provider = createEchoProvider(env);

  return provider.respond({ message: 'oi', context, config });
}

describe('provider echo', () => {
  it('se identifica e descreve a si mesmo', () => {
    const provider = createEchoProvider({});

    assert.equal(provider.name, 'echo');
    assert.match(provider.describe(), /sem chamar modelo/);
  });

  it('devolve a mensagem recebida', async () => {
    const { response } = await respond();

    assert.match(response, /Recebi: "oi"/);
  });

  it('mostra o config no texto, para o repasse ser conferido sem chave', async () => {
    const { response } = await respond({
      language: 'en-US',
      tone: 'formal',
      response_length: 'detailed',
    });

    assert.match(response, /en-US/);
    assert.match(response, /formal/);
    assert.match(response, /detailed/);
  });

  it('devolve sugestões por padrão', async () => {
    const { suggestions } = await respond();

    assert.ok(suggestions);
    assert.equal(suggestions.length, 2);
  });

  it('não devolve sugestões com AI_NO_SUGGESTIONS', async () => {
    const { suggestions } = await respond(DEFAULT_CHAT_CONFIG, {
      AI_NO_SUGGESTIONS: '1',
    });

    assert.equal(suggestions, null);
  });

  it('lê AI_NO_SUGGESTIONS no arranque, valendo para todas as requisições', async () => {
    const provider = createEchoProvider({ AI_NO_SUGGESTIONS: '1' });

    const first = await provider.respond({
      message: 'oi',
      context,
      config: DEFAULT_CHAT_CONFIG,
    });
    const second = await provider.respond({
      message: 'oi de novo',
      context,
      config: DEFAULT_CHAT_CONFIG,
    });

    assert.equal(first.suggestions, null);
    assert.equal(second.suggestions, null);
  });
});

describe('createProvider', () => {
  it('resolve echo pelo nome', async () => {
    const { createProvider } =
      await import('../../../../src/services/ai/provider.js');
    const provider = await createProvider({ AI_PROVIDER: 'echo' });

    assert.equal(provider.name, 'echo');
  });

  it('recusa provider desconhecido, dizendo os nomes', async () => {
    const { createProvider } =
      await import('../../../../src/services/ai/provider.js');

    await assert.rejects(
      () => createProvider({ AI_PROVIDER: 'openai' }),
      /AI_PROVIDER deve ser um de/,
    );
  });

  it('cai no nvidia quando AI_PROVIDER não vem', async () => {
    const { createProvider } =
      await import('../../../../src/services/ai/provider.js');
    const provider = await createProvider({ NVIDIA_API_KEY: 'x' });

    assert.equal(provider.name, 'nvidia');
  });
});
