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
const DEFAULT_TIMEOUT_MS = 300000;
const DEFAULT_MAX_TOKENS = 400;
const SUGGESTION_MAX_TOKENS = 200;
interface Completion {
  choices?: {
    message?: {
      content?: string;
    };
  }[];
}
interface NvidiaConfig {
  baseUrl: string;
  model: string;
  apiKey: string;
  timeoutMs: number;
  maxTokens: number;
  ignoreConfig: boolean;
  noSuggestions: boolean;
}
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
export function createNvidiaProvider(
  env: NodeJS.ProcessEnv = process.env,
): AIProvider {
  const config = loadConfig(env);
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
      let suggestions: AIProviderResponse['suggestions'] = null;
      if (!config.noSuggestions) {
        try {
          const raw = await suggest(response, message, tenant);
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
