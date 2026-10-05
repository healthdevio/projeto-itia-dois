/**
 * Mia AI Client
 *
 * Cliente HTTP do Core para o servidor da Mia AI (`apps/packages/mia-ai`).
 *
 * O Core **não sabe o que é um modelo de linguagem.** Ele não conhece
 * provider, modelo, prompt, temperatura nem formato de requisição de nenhuma
 * API de IA. Tudo isso é responsabilidade do servidor da Mia AI.
 *
 * O Core conhece apenas três coisas:
 *
 * 1. O contrato de contexto, `MiaAIContext` — montado aqui, a partir do estado
 *    que o próprio Core guarda. É isso que torna a Mia AI ciente do diálogo sem
 *    que ela precise ter estado próprio.
 * 2. O contrato de configuração, `ChatConfig` — o que a interface pediu nesta
 *    mensagem, repassado sem tradução (ver `src/models/chat-config.ts`).
 * 3. O endpoint HTTP da Mia AI, para onde vai `{ message, context, config }` e
 *    de onde volta o texto da resposta.
 *
 * ## Contrato com o servidor da Mia AI
 *
 * Requisição — `POST $MIA_AI_ENDPOINT`:
 *
 * ```json
 * {
 *   "message": { "message_id": "...", "message": "...", "origin": "frontend" },
 *   "context": {
 *     "conversation_id": "...",
 *     "state": "idle",
 *     "previous_messages": [{ "message_id": "...", "message": "...", "role": "user" }],
 *     "history_ids": ["..."],
 *     "max_context_messages": 20
 *   },
 *   "config": { "language": "pt-BR", "tone": "neutral", "response_length": "standard" }
 * }
 * ```
 *
 * `config` é a configuração que a interface escolheu para esta mensagem, repassada
 * sem interpretação — ver `src/models/chat-config.ts`. Ela vem no topo, e não
 * dentro do `context`, porque não é estado da conversa: é pedido da interface.
 * Um servidor da Mia AI que não a conhece pode ignorá-la.
 *
 * Resposta — `200` com:
 *
 * ```json
 * {
 *   "response": "texto da Mia AI",
 *   "suggestions": [{ "suggestion_id": "sg-1", "text": "Ver meu agendamento" }]
 * }
 * ```
 *
 * `suggestions` é opcional: quem decide o que sugerir é a Mia AI, e uma
 * resposta sem esse campo é válida. Quando vem, o Core guarda as sugestões na
 * conversa ativa do usuário (ver `src/repositories/suggestion-repository.ts`).
 *
 * A conversa em si nunca é enviada: apenas a mensagem nova, o contexto e a
 * configuração.
 */

import type { Message } from '../models/message.js';
import type {
  ConversationMessage,
  ConversationState,
} from '../models/conversation.js';
import { readSuggestions, type Suggestion } from '../models/suggestion.js';
import { formatChatConfig, type ChatConfig } from '../models/chat-config.js';

/**
 * Contexto da conversa repassado junto com a nova mensagem.
 *
 * Não é a conversa inteira: é a fatia mínima que a Mia AI precisa para estar
 * ciente do contexto.
 */
export interface MiaAIContext {
  /** Id da conversa em que a mensagem foi enviada. */
  conversation_id: string;

  /** Estado da conversa no momento do envio. */
  state: ConversationState;

  /** Mensagens anteriores da conversa, em ordem cronológica. */
  previous_messages: ConversationMessage[];

  /** Ids das conversas anteriores, mais recente primeiro. */
  history_ids: string[];

  /**
   * Quantas mensagens anteriores são enviadas por padrão. O histórico completo
   * pode estourar o contexto da janela da IA em conversas longas.
   */
  max_context_messages: number;
}

/** Quantas mensagens anteriores vão por padrão no contexto. */
const DEFAULT_CONTEXT_WINDOW = 20;

/** Payload enviado à Mia AI. */
export interface MiaAIRequest {
  /** A mensagem nova do usuário. */
  message: Message;

  /** Contexto da conversa. */
  context: MiaAIContext;

  /**
   * Configuração escolhida pela interface.
   *
   * Vai no topo do payload, e não dentro do `context`, porque não faz parte do
   * estado da conversa: é o que a **interface** pediu para esta mensagem, e não
   * o que o Core leu do Postgres. Quem decide o que fazer com ela é a Mia AI —
   * um servidor que não conhece o campo pode simplesmente ignorá-lo.
   *
   * Sempre completa: o Core aplicou `DEFAULT_CHAT_CONFIG` no que faltou.
   */
  config: ChatConfig;
}

/** Resposta da Mia AI. */
export interface MiaAIResponse {
  /** Texto devolvido pelo servidor da Mia AI. */
  response: string;

  /**
   * Sugestões que a Mia AI anexou à resposta.
   *
   * `null` significa "a Mia AI não falou de sugestões" — a resposta veio sem o
   * campo, e o Core preserva as sugestões que já tinha. Uma lista vazia, ao
   * contrário, é uma decisão: limpa as sugestões daquela conversa.
   *
   * A distinção existe porque a produção das sugestões é responsabilidade da
   * Mia AI, e um servidor que ainda não devolve o campo não deve apagar o que
   * a interface está exibindo.
   */
  suggestions: Suggestion[] | null;
}

// ---------------------------------------------------------------------------
// Configuração
// ---------------------------------------------------------------------------

export interface MiaAIConfig {
  /** URL do endpoint da Mia AI. */
  endpoint: string;

  /**
   * Token de serviço para o Core se autenticar na Mia AI.
   *
   * Autentica a chamada **entre serviços** — não tem relação com a identidade
   * do usuário, que vem de `X-User-Id`. O servidor da Mia AI decide se exige.
   */
  serviceToken?: string;

  timeoutMs: number;
}

/**
 * Lê a configuração da Mia AI do ambiente.
 *
 * `MIA_AI_ENDPOINT` é obrigatória: sem ela o Core não tem contra quem falar.
 * Erros de configuração saem como `MiaAIError` para que a interface receba a
 * causa em vez de um "erro interno" genérico.
 */
export function loadMiaAIConfig(
  env: NodeJS.ProcessEnv = process.env,
): MiaAIConfig {
  const endpoint = env.MIA_AI_ENDPOINT?.trim();

  if (!endpoint) {
    throw new MiaAIError(
      'MIA_AI_ENDPOINT não definida. O Core precisa do endpoint do servidor da Mia AI.',
    );
  }

  return {
    endpoint,
    serviceToken: env.MIA_AI_SERVICE_TOKEN,
    timeoutMs: Number(env.MIA_AI_TIMEOUT_MS ?? 60_000),
  };
}

// ---------------------------------------------------------------------------
// Erro
// ---------------------------------------------------------------------------

/**
 * Falha na chamada ao servidor da Mia AI.
 *
 * Vira `502`: o Core funcionou, mas o serviço do qual ele depende não.
 */
export class MiaAIError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'MiaAIError';
  }
}

// ---------------------------------------------------------------------------
// Contexto
// ---------------------------------------------------------------------------

/**
 * Monta o contexto a partir do estado atual da conversa.
 *
 * @param conversationId - Id da conversa ativa
 * @param state - Estado atual da máquina de estados
 * @param messages - Mensagens já persistidas na conversa ativa
 * @param historyIds - Ids das conversas anteriores, mais recente primeiro
 * @param maxContextMessages - Janela de contexto
 */
export function buildContext(
  conversationId: string,
  state: ConversationState,
  messages: ConversationMessage[],
  historyIds: string[],
  maxContextMessages = DEFAULT_CONTEXT_WINDOW,
): MiaAIContext {
  return {
    conversation_id: conversationId,
    state,
    // As `maxContextMessages` mais recentes bastam: as mais antigas já
    // saíram da janela e são as menos relevantes para a resposta atual.
    previous_messages: messages.slice(-maxContextMessages),
    history_ids: historyIds,
    max_context_messages: maxContextMessages,
  };
}

// ---------------------------------------------------------------------------
// Envio
// ---------------------------------------------------------------------------

/**
 * Corpo aceito como resposta válida.
 *
 * A forma canônica é `{ "response": "...", "suggestions": [...] }`. O
 * envelope `success`/`data` do próprio Core também é aceito, para um servidor
 * da Mia AI feito à mão não ter que acertar o formato exato.
 *
 * Sugestões malformadas não invalidam a resposta: o texto da Mia AI é o que a
 * interface precisa mostrar, e uma sugestão ruim é um detalhe a menos. O que
 * não for sugestão é descartado — ver `readSuggestions`.
 *
 * @returns O texto e as sugestões, ou `null` se não houver `response`.
 */
function readBody(
  body: unknown,
): { response: string; suggestions: Suggestion[] | null } | null {
  if (typeof body !== 'object' || body === null) {
    return null;
  }

  const envelope = body as {
    response?: unknown;
    suggestions?: unknown;
    data?: { response?: unknown; suggestions?: unknown };
  };

  const response = envelope.response ?? envelope.data?.response;

  if (typeof response !== 'string' || response.trim() === '') {
    return null;
  }

  // `undefined` = o campo não veio. `null` = veio e não é uma lista de
  // sugestões; nesse caso não há o que salvar, e o Core preserva as antigas.
  const raw = envelope.suggestions ?? envelope.data?.suggestions;

  return {
    response,
    suggestions: raw === undefined ? null : readSuggestions(raw),
  };
}

/**
 * Envia uma mensagem para a Mia AI junto com o contexto e a configuração.
 *
 * É a única chamada que o Core faz para fora do seu processo.
 *
 * @param request - Mensagem, contexto e config a enviar
 * @param config - Configuração do endpoint
 * @returns Resposta da Mia AI
 */
export async function sendToMiaAI(
  request: MiaAIRequest,
  config: MiaAIConfig = loadMiaAIConfig(),
): Promise<MiaAIResponse> {
  // `config` abaixo é a configuração do endpoint (endpoint, token, timeout),
  // então o config da conversa entra renomeado, para não precisar distinguir os
  // dois a cada uso.
  const { message, context, config: chatConfig } = request;

  let response: Response;

  try {
    response = await fetch(config.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...(config.serviceToken
          ? { Authorization: `Bearer ${config.serviceToken}` }
          : {}),
      },
      body: JSON.stringify({ message, context, config: chatConfig }),
      signal: AbortSignal.timeout(config.timeoutMs),
    });
  } catch (error) {
    // fetch só lança em falha de rede ou timeout (AbortError).
    const reason =
      error instanceof Error && error.name === 'TimeoutError'
        ? `tempo esgotado após ${config.timeoutMs}ms`
        : error instanceof Error
          ? error.message
          : 'erro desconhecido';

    throw new MiaAIError(`Falha de rede ao chamar a Mia AI: ${reason}`);
  }

  if (!response.ok) {
    // O corpo do erro pode ou não ser JSON; o status é o fallback.
    let detail = `HTTP ${response.status}`;

    try {
      const body = (await response.json()) as {
        error?: string;
        detail?: string;
      };
      detail = body.error ?? body.detail ?? detail;
    } catch {
      // Corpo não-JSON: fica só com o status.
    }

    throw new MiaAIError(
      `Mia AI respondeu com erro: ${detail}`,
      response.status,
    );
  }

  let body: unknown;

  try {
    body = await response.json();
  } catch {
    throw new MiaAIError('Mia AI respondeu sem corpo JSON.');
  }

  const result = readBody(body);

  if (result === null) {
    throw new MiaAIError(
      'Mia AI respondeu sem o campo "response". Ver o contrato em src/services/mia-ai.ts.',
    );
  }

  console.log(
    `[Mia AI] ${message.message_id} → ${config.endpoint} ` +
      `(conversa ${context.conversation_id}, ` +
      `${context.previous_messages.length} mensagens de contexto, ` +
      `${context.history_ids.length} conversas anteriores, ` +
      `config ${formatChatConfig(chatConfig)}` +
      (result.suggestions === null
        ? ', sem sugestões)'
        : `, ${result.suggestions.length} sugestões)`),
  );

  return result;
}
