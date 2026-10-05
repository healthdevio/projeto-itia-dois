/**
 * Provider da Nvidia (NIM) — **substituto temporário de teste**.
 *
 * Fala com o backend da Nvidia, compatível com a API da OpenAI:
 *
 * ```
 * POST $NVIDIA_BASE_URL/chat/completions
 * Authorization: Bearer $NVIDIA_API_KEY
 * ```
 *
 * ## Duas chamadas ao modelo, de propósito
 *
 * 1. A resposta, com o `context` que o Core montou e o `config` que a interface
 *    escolheu — a montagem está em `../prompt.ts`.
 * 2. As sugestões, num JSON aparte. Perguntar "sugira 3 ações" no mesmo prompt
 *    da resposta deixa a resposta pior; e um JSON malformado quebra só a
 *    segunda chamada, nunca a conversa.
 *
 * ## Tempo de espera
 *
 * O timeout é bem maior que o padrão de HTTP porque a Nvidia **não devolve a
 * resposta pronta**: ela fica escrevendo token a token, e uma resposta longa
 * pode passar dos 60 s easily sem que nada esteja errado. Cortar em 60 s
 * matava a requisição no meio da digitação, e o usuário recebia um erro em vez
 * da resposta que estava a caminho.
 *
 * O valor é configurável em `NVIDIA_TIMEOUT_MS`, e o padrão folgado de propósito
 * — cortar cedo é ótimo para detecting travamento, péssimo para uma geração
 * longa. Ainda assim continua sendo um teto: um provider pendurado vira erro
 * em vez de vazar uma requisição para sempre.
 *
 * ## Variáveis
 *
 * | Variável             | Padrão                                  |
 * | -------------------- | --------------------------------------- |
 * | `NVIDIA_API_KEY`     | — (obrigatória)                         |
 * | `NVIDIA_MODEL`       | `meta/llama-3.3-70b-instruct`           |
 * | `NVIDIA_BASE_URL`    | `https://integrate.api.nvidia.com/v1`   |
 * | `NVIDIA_TIMEOUT_MS`  | `300000` (5 min)                        |
 * | `NVIDIA_MAX_TOKENS`  | `400`                                   |
 * | `AI_IGNORE_CONFIG` | `1` = ignora o `config` da interface  |
 */

import { readSuggestions } from '../../../models/suggestion.js';
import { formatChatConfig } from '../../../models/chat-config.js';
import { AIError } from '../error.js';
import { resolvePrompt } from '../prompts.js';
import {
  extractJsonArray,
  toChatMessages,
  toSuggestionPrompt,
} from '../prompt.js';
import type {
  AIProvider,
  AIProviderRequest,
  AIProviderResponse,
  ChatMessage,
} from '../provider.js';

/**
 * Teto de espera por resposta do modelo.
 *
 * 5 min em vez dos 60 s que matavam a geração. Uma resposta `detailed` de um
 * modelo grande, com o histórico da conversa indo junto, leva tempo — e o
 * provider está escrevendo a maior parte dele. O valor continua sendo
 * configurável: em teste local convém um teto menor para não esperar cinco
 * minutos por um provider que morreu.
 */
const DEFAULT_TIMEOUT_MS = 300_000;

/** Tokens máximos por chamada. Cobre uma resposta `detailed`. */
const DEFAULT_MAX_TOKENS = 400;

/** Tokens da chamada curta que só devolve as sugestões. */
const SUGGESTION_MAX_TOKENS = 200;

/** Resposta de um chat completion, no formato da OpenAI. */
interface Completion {
  choices?: { message?: { content?: string } }[];
}

/** Configuração do provider, lida do ambiente. */
interface NvidiaConfig {
  baseUrl: string;
  model: string;
  apiKey: string;
  timeoutMs: number;
  maxTokens: number;
  ignoreConfig: boolean;

  /** `1` = não produz sugestões, para exercitar o caminho em que a AI não as devolve. */
  noSuggestions: boolean;
}

/**
 * Lê a configuração da Nvidia do ambiente.
 *
 * `NVIDIA_API_KEY` é obrigatória aqui e não no boot: o Core sobe sem provider
 * funcional e só o POST `/api/messages` descobre que falta a chave, que é
 * quando a falha importa.
 */
function loadConfig(env: NodeJS.ProcessEnv): NvidiaConfig {
  const apiKey = env.NVIDIA_API_KEY?.trim();

  if (!apiKey) {
    throw new AIError(
      'NVIDIA_API_KEY não definida. Crie uma chave em https://build.nvidia.com, ou rode com AI_PROVIDER=echo para testar sem gastar cota.',
    );
  }

  return {
    baseUrl:
      env.NVIDIA_BASE_URL?.replace(/\/+$/, '') ??
      'https://integrate.api.nvidia.com/v1',
    model: env.NVIDIA_MODEL ?? 'meta/llama-3.3-70b-instruct',
    apiKey,
    timeoutMs: Number(env.NVIDIA_TIMEOUT_MS ?? DEFAULT_TIMEOUT_MS),
    maxTokens: Number(env.NVIDIA_MAX_TOKENS ?? DEFAULT_MAX_TOKENS),
    ignoreConfig: env.AI_IGNORE_CONFIG === '1',
    noSuggestions: env.AI_NO_SUGGESTIONS === '1',
  };
}

/** Provider que fala com o backend da Nvidia. */
export function createNvidiaProvider(
  env: NodeJS.ProcessEnv = process.env,
): AIProvider {
  const config = loadConfig(env);

  /**
   * Chama o modelo e devolve o texto.
   *
   * O erro do provider vira `AIError` com a mensagem do próprio provider: o
   * Core a repassa no 502, e é essa mensagem que diz se o problema foi chave
   * inválida, modelo inexistente ou cota.
   */
  async function complete(
    messages: ChatMessage[],
    maxTokens: number,
  ): Promise<string> {
    let response: Response;

    try {
      response = await fetch(`${config.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify({
          model: config.model,
          messages,
          max_tokens: maxTokens,
        }),
        // O teto cobre a geração inteira, não o primeiro byte: é isso que
        // permite uma resposta longa terminar em vez de ser cortada no meio.
        signal: AbortSignal.timeout(config.timeoutMs),
      });
    } catch (error) {
      const reason =
        error instanceof Error && error.name === 'TimeoutError'
          ? `tempo esgotado após ${config.timeoutMs}ms`
          : error instanceof Error
            ? error.message
            : 'erro desconhecido';

      throw new AIError(`Falha ao chamar a Nvidia: ${reason}`);
    }

    if (!response.ok) {
      const detail = await response.text().catch(() => '');

      throw new AIError(
        `NVIDIA ${response.status}: ${detail.slice(0, 500)}`,
        response.status,
      );
    }

    let body: Completion;

    try {
      body = (await response.json()) as Completion;
    } catch {
      throw new AIError('NVIDIA respondeu sem corpo JSON.');
    }

    const content = body.choices?.[0]?.message?.content;

    if (typeof content !== 'string' || content.trim() === '') {
      throw new AIError('NVIDIA respondeu sem choices[0].message.content');
    }

    return content.trim();
  }

  /**
   * Pergunta ao modelo quais ações sugerir depois da resposta.
   *
   * Parse tolerante: se nada virar lista, devolve `null` e o Core preserva as
   * sugestões anteriores em vez de limpar (ver `extractJsonArray`).
   */
  async function suggest(
    reply: string,
    ask: string,
    tenant?: string,
  ): Promise<unknown[] | null> {
    const template = resolvePrompt(tenant);

    const raw = await complete(
      [
        { role: 'system', content: template.suggestionsSystem },
        {
          role: 'user',
          content: toSuggestionPrompt(reply, ask, template),
        },
      ],
      SUGGESTION_MAX_TOKENS,
    );

    return extractJsonArray(raw);
  }

  return {
    name: 'nvidia',

    describe: () => `${config.model} (teto de ${config.timeoutMs}ms)`,

    async respond({
      message,
      context,
      config: chatConfig,
      tenant,
    }: AIProviderRequest): Promise<AIProviderResponse> {
      const started = Date.now();

      // O prompt vem do tenant. Desconhecido cai no padrão, sem erro — o log
      // mostra `tenant:default` para isso ficar visível na hora.
      const template = resolvePrompt(tenant);

      const response = await complete(
        toChatMessages(
          message,
          context,
          chatConfig,
          template,
          config.ignoreConfig,
        ),
        config.maxTokens,
      );

      // Sugestão é bônus: se esta chamada falhar, a resposta ainda volta. Perder
      // as sugestões é um detalhe; perder a resposta derruba a conversa.
      let suggestions: AIProviderResponse['suggestions'] = null;

      if (!config.noSuggestions) {
        try {
          const raw = await suggest(response, message, tenant);

          // `null` = o modelo não produziu lista. O Core preserva o que já tinha.
          suggestions = raw === null ? null : readSuggestions(raw);
        } catch (error) {
          console.warn(
            `[Nvidia] sem sugestões: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }

      console.log(
        `[Nvidia] ${context.conversation_id} · ` +
          `tenant ${tenant ?? 'default'} · ` +
          `${context.previous_messages.length} mensagens de contexto · ` +
          `${context.history_ids.length} conversas anteriores · ` +
          `config ${formatChatConfig(chatConfig)}` +
          `${config.ignoreConfig ? ' (ignorado)' : ''} · ` +
          `${Date.now() - started}ms · ` +
          `${suggestions === null ? 'sem sugestões' : `${suggestions.length} sugestões`}`,
      );

      return { response, suggestions };
    },
  };
}
