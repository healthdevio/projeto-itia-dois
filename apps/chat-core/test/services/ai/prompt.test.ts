import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  extractJsonArray,
  systemPrompt,
  toChatMessages,
  toSuggestionPrompt,
} from '../../../src/services/ai/prompt.js';
import {
  DEFAULT_CHAT_CONFIG,
  type ChatConfig,
} from '../../../src/models/chat-config.js';
import { DEFAULT_PROMPT } from '../../../src/models/prompt-template.js';
import type { AIContext } from '../../../src/services/ai/context.js';

function context(overrides: Partial<AIContext> = {}): AIContext {
  return {
    conversation_id: 'c1',
    state: 'idle',
    previous_messages: [],
    history_ids: [],
    max_context_messages: 20,
    ...overrides,
  };
}

const config: ChatConfig = { ...DEFAULT_CHAT_CONFIG };

describe('systemPrompt', () => {
  it('começa pela persona', () => {
    assert.ok(
      systemPrompt(config, DEFAULT_PROMPT).startsWith(DEFAULT_PROMPT.persona),
    );
  });

  it('inclui a instrução de idioma, tom e tamanho escolhidos', () => {
    const prompt = systemPrompt(
      { language: 'en-US', tone: 'formal', response_length: 'short' },
      DEFAULT_PROMPT,
    );

    assert.match(prompt, /Reply in English\./);
    assert.match(prompt, /Fale formalmente/);
    assert.match(prompt, /1 a 2 frases/);
  });

  it('não mistura a instrução de um valor com o de outro', () => {
    const prompt = systemPrompt(
      { language: 'en-US', tone: 'formal', response_length: 'short' },
      DEFAULT_PROMPT,
    );

    assert.doesNotMatch(prompt, /Responda em português/);
    assert.doesNotMatch(prompt, /5 a 8 frases/);
  });

  it('ignora o config quando pedido', () => {
    const prompt = systemPrompt(
      { language: 'en-US', tone: 'formal', response_length: 'detailed' },
      DEFAULT_PROMPT,
      true,
    );

    assert.equal(prompt, DEFAULT_PROMPT.persona);
  });

  it('não deixa buraco duplo quando o template não tem a dica', () => {
    const prompt = systemPrompt(
      { language: 'pt-BR', tone: 'formal', response_length: 'short' },
      {
        ...DEFAULT_PROMPT,
        toneHints: {},
        lengthHints: {},
      },
    );

    assert.equal(
      prompt,
      `${DEFAULT_PROMPT.persona} Responda em português do Brasil.`,
    );
  });
});

describe('toChatMessages', () => {
  it('abre com o system prompt e fecha com a mensagem nova', () => {
    const messages = toChatMessages('oi', context(), config, DEFAULT_PROMPT);

    assert.equal(messages[0].role, 'system');
    assert.equal(messages.at(-1)?.role, 'user');
    assert.equal(messages.at(-1)?.content, 'oi');
  });

  it('leva as mensagens passadas mantendo a ordem', () => {
    const messages = toChatMessages(
      'agora',
      context({
        previous_messages: [
          {
            message_id: 'm1',
            message: 'antes',
            origin: 'frontend',
            role: 'user',
          },
          {
            message_id: 'm2',
            message: 'resposta',
            origin: 'ai',
            role: 'assistant',
          },
        ],
      }),
      config,
      DEFAULT_PROMPT,
    );

    assert.deepEqual(
      messages.map((m) => [m.role, m.content]),
      [
        ['system', systemPrompt(config, DEFAULT_PROMPT)],
        ['user', 'antes'],
        ['assistant', 'resposta'],
        ['user', 'agora'],
      ],
    );
  });

  it('avisa o modelo sobre conversas anteriores, sem mandar o conteúdo delas', () => {
    const messages = toChatMessages(
      'oi',
      context({ history_ids: ['h1', 'h2'] }),
      config,
      DEFAULT_PROMPT,
    );

    const aviso = messages[1];

    assert.equal(aviso.role, 'system');
    assert.match(aviso.content, /2 vez/);
    for (const id of ['h1', 'h2']) {
      assert.doesNotMatch(aviso.content, new RegExp(id));
    }
  });

  it('não cria a aviso de histórico quando não há conversa anterior', () => {
    const messages = toChatMessages('oi', context(), config, DEFAULT_PROMPT);

    assert.equal(messages.filter((m) => m.role === 'system').length, 1);
  });

  it('descarta mensagem anterior sem texto, sem quebrar a montagem', () => {
    const messages = toChatMessages(
      'agora',
      context({
        previous_messages: [
          {
            message_id: 'm1',
            message: 42 as unknown as string,
            origin: 'frontend',
            role: 'user',
          },
        ],
      }),
      config,
      DEFAULT_PROMPT,
    );

    assert.deepEqual(
      messages.map((m) => m.content),
      [systemPrompt(config, DEFAULT_PROMPT), 'agora'],
    );
  });
});

describe('toSuggestionPrompt', () => {
  it('inclui a resposta, a pergunta e a instrução do template', () => {
    const prompt = toSuggestionPrompt(
      'Tudo certo.',
      'Como vai?',
      DEFAULT_PROMPT,
    );

    assert.match(prompt, /Tudo certo\./);
    assert.match(prompt, /Como vai\?/);
    assert.match(prompt, /array JSON de strings/);
  });
});

describe('extractJsonArray', () => {
  it('lê o array puro', () => {
    assert.deepEqual(extractJsonArray('["a", "b"]'), ['a', 'b']);
  });

  it('lê o array dentro de cerca de código', () => {
    assert.deepEqual(extractJsonArray('```json\n["a"]\n```'), ['a']);
  });

  it('lê o array no meio de um texto', () => {
    assert.deepEqual(extractJsonArray('Aqui vai: ["a"] — espero ajudar.'), [
      'a',
    ]);
  });

  it('devolve null quando não há array', () => {
    assert.equal(extractJsonArray('não sou json'), null);
    assert.equal(extractJsonArray(''), null);
  });

  it('devolve null para JSON que não é array', () => {
    assert.equal(extractJsonArray('{"a": 1}'), null);
  });

  it('devolve null para array quebrado', () => {
    assert.equal(extractJsonArray('["a", '), null);
  });
});
