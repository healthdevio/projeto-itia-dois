/**
 * Message Routes
 *
 * Endpoint que recebe mensagens da interface e as repassa para a Mia AI.
 *
 * Diferente da conversa, a mensagem é o único dado que sai do Core. A cada
 * envio, o Core também carrega o contexto da conversa — as mensagens
 * anteriores e os ids do histórico — para que a Mia AI responda com
 * consciência do diálogo. A conversa em si nunca é enviada.
 *
 * O corpo pode vir acompanhado de `config`, a configuração escolhida na tela
 * (idioma, tom, tamanho da resposta). O Core valida, completa com os defaults e
 * repassa para a Mia AI sem interpretar nada — ver
 * `src/models/chat-config.ts`.
 *
 * O header `X-Tenant-Id`, quando presente, escolhe o prompt da requisição. Ele
 * não interfere no isolamento dos dados: a conversa continua sendo a de quem
 * enviou, resolvida por `X-User-Id`.
 *
 * A resposta da Mia AI pode vir acompanhada de `suggestions` (ver
 * `src/services/mia-ai/`). Quando vem, o Core substitui as sugestões da
 * conversa ativa pelas novas e as devolve junto da resposta, para a interface
 * renderizar as chips sem uma segunda chamada.
 */

import { Hono } from 'hono';

import { identity, type IdentityVariables } from '../middleware/identity.js';
import {
  MiaAIError,
  buildContext,
  sendToMiaAI,
} from '../services/mia-ai/index.js';
import {
  appendMessage,
  getHistoryIds,
  getOrCreateActiveConversation,
  setConversationState,
} from '../repositories/conversation-repository.js';
import {
  replaceActiveSuggestions,
  getActiveSuggestions,
} from '../repositories/suggestion-repository.js';
import {
  formatChatConfig,
  validateChatConfig,
  type ChatConfig,
  type ChatConfigInput,
} from '../models/chat-config.js';
import type { ApiResponse, Message } from '../models/message.js';
import type { Suggestion } from '../models/suggestion.js';

export const messageRoutes = new Hono<{ Variables: IdentityVariables }>();

// Toda rota deste router exige identidade.
messageRoutes.use('*', identity);

/**
 * Corpo de `POST /api/messages`.
 *
 * É a mensagem mais o `config` opcional da interface. O `config` não faz parte
 * de `Message` justamente porque a mensagem é persistida e o config não é: ele
 * vale para este envio e some depois (ver `src/models/chat-config.ts`).
 */
interface MessageRequestBody extends Message {
  /** Configuração escolhida na interface. Todos os campos são opcionais. */
  config?: ChatConfigInput;
}

/**
 * Resposta do endpoint de mensagens.
 */
interface MessageResponseData {
  message_id: string;
  mia_ai_response: string;

  /**
   * Sugestões da conversa ativa depois desta resposta.
   *
   * Vem preenchida quando a Mia AI devolveu `suggestions` — nesse caso a lista
   * anterior foi substituída. Quando a Mia AI não falou de sugestões, é a
   * lista que já estava na conversa, sem alteração.
   */
  suggestions: Suggestion[];

  /**
   * Configuração que o Core repassa para a Mia AI neste envio.
   *
   * É a que foi pedida, já com o que faltava preenchido pelo default — não
   * necessariamente a que a interface mandou. Devolver o efetivo é o que
   * permite à tela mostrar o que vale sem guardar a configuração por conta
   * própria.
   */
  config: ChatConfig;
}

/**
 * Endpoint para receber mensagens da interface
 *
 * POST /api/messages
 *
 * Recebe uma mensagem do frontend, valida, persiste na conversa ativa **do
 * usuário que fez a requisição** e repassa para a Mia AI com o contexto
 * acumulado e a configuração da tela (`config`, opcional).
 *
 * A resposta traz `config` com a configuração efetiva — a que foi repassada,
 * já completada com os defaults. É o que a interface usa para mostrar o que
 * vale, em vez de ter que reproduzir os defaults sozinha.
 *
 * A resposta traz também `suggestions`: as sugestões que a Mia AI devolveu com
 * a resposta, já gravadas na conversa. A interface renderiza as chips direto
 * dali, sem precisar de `GET /api/suggestions` logo em seguida.
 *
 * Códigos de resposta:
 * - 200: Sucesso
 * - 400: JSON inválido, corpo que não é objeto, campos obrigatórios faltando
 *   ou `config` inválido. O erro de config diz o campo e os valores aceitos.
 * - 401: Identidade ausente ou inválida
 * - 500: Erro interno
 * - 502: O provider da Mia AI falhou (chave inválida, limite de taxa, timeout).
 *   O corpo traz o motivo do provider; a interface usa isso para oferecer retry.
 */
messageRoutes.post('/', async (c) => {
  const userId = c.get('userId');

  // Escolhe o prompt, e só o prompt: o tenant não muda quem é o usuário nem a
  // que conversa ele tem. Ausente ou desconhecido, vale o prompt padrão.
  const tenantId = c.get('tenantId');

  // Corpo inválido é erro do cliente, não do Core: o parse fica fora do try
  // que trata falha interna, para que JSON quebrado não vire 500.
  let parsed: unknown;

  try {
    parsed = await c.req.json();
  } catch {
    const response: ApiResponse = {
      success: false,
      error: 'JSON inválido no corpo da requisição',
    };
    return c.json(response, 400);
  }

  // `null` e `[]` são JSON válido e não são corpo de requisição. Sem esta
  // checagem, o acesso a `body.message_id` estouraria e o cliente receberia um
  // 500 por um corpo que ele mesmo mandou errado.
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    const response: ApiResponse = {
      success: false,
      error: 'Corpo da requisição inválido',
    };
    return c.json(response, 400);
  }

  const body = parsed as MessageRequestBody;

  // A configuração vai ser repassada para a Mia AI. Validar antes de qualquer
  // escrita no banco evita gravar a mensagem de um usuário para só descobrir
  // depois que o config não prestava.
  const chatConfig = validateChatConfig(body.config);

  if (!chatConfig.ok) {
    const response: ApiResponse = {
      success: false,
      error: chatConfig.error,
    };
    return c.json(response, 400);
  }

  try {
    // Validação dos campos obrigatórios
    if (!body.message_id || !body.message || !body.origin) {
      const response: ApiResponse = {
        success: false,
        error: 'Campos obrigatórios faltando: message_id, message, origin',
      };
      return c.json(response, 400);
    }

    // Adiciona data se não fornecida. O `config` fica de fora de propósito: ele
    // não é persistido, e `appendMessage` lê só os campos da mensagem.
    const message: Message = {
      message_id: body.message_id,
      message: body.message,
      metadata: body.metadata,
      origin: body.origin,
      date: body.date || new Date().toISOString(),
    };

    console.log(
      `[Core] Mensagem recebida de ${message.origin} (usuário ${userId}):`,
      message.message_id,
      `· tenant ${tenantId ?? 'default'}`,
      `· config ${formatChatConfig(chatConfig.config)}`,
    );

    // Carrega a conversa ativa DO USUÁRIO. Criada aqui caso seja a primeira
    // mensagem dele.
    const conversation = await getOrCreateActiveConversation(userId);

    // Monta o contexto ANTES de persistir, para que a mensagem atual não
    // apareça como se fosse histórico.
    const context = buildContext(
      conversation.id,
      conversation.state,
      conversation.messages,
      // Ids das conversas anteriores deste usuário — a Mia AI fica ciente de
      // que houve diálogos anteriores, sem receber o conteúdo deles.
      await getHistoryIds(userId),
    );

    // A interface só envia mensagens de usuário; a resposta da Mia AI é
    // persistida com role `mia` abaixo.
    await appendMessage(message, 'user', conversation.id);

    // Enquanto a Mia AI processa, a interface mostra o indicador de
    // carregamento.
    await setConversationState(userId, 'thinking');

    // Envia para a Mia AI. É aqui que a mensagem sai do Core — a conversa,
    // não. O `config` vai junto, sem interpretação: quem decide o que fazer com
    // ele é o provider, que roda dentro do processo (ver
    // `src/services/mia-ai/`).
    const miaResponse = await sendToMiaAI({
      message,
      context,
      config: chatConfig.config,
      tenant: tenantId,
    });

    // Persiste a resposta da Mia AI na conversa.
    const miaMessage: Message = {
      message_id: `${message.message_id}-mia`,
      message: miaResponse.response,
      date: new Date().toISOString(),
      origin: 'mia-ai',
    };
    await appendMessage(miaMessage, 'mia', conversation.id);

    // As sugestões da resposta substituem as da resposta anterior: o contexto
    // já mudou, e uma chip desatualizada levaria o usuário a pedir algo que a
    // Mia AI já respondeu. `null` = a Mia AI não devolveu o campo, e aí o que
    // já estava na conversa continua valendo.
    const suggestions =
      miaResponse.suggestions === null
        ? await getActiveSuggestions(userId)
        : await replaceActiveSuggestions(userId, miaResponse.suggestions);

    await setConversationState(userId, 'idle');

    const response: ApiResponse<MessageResponseData> = {
      success: true,
      data: {
        message_id: message.message_id,
        mia_ai_response: miaResponse.response,
        suggestions,
        // A configuração que a Mia AI recebeu. A interface usa isso para
        // alinhar a tela com o que de fato vale neste envio.
        config: chatConfig.config,
      },
    };

    return c.json(response, 200);
  } catch (error) {
    // Erro do provider da Mia AI tem causa conhecida (chave inválida, limite
    // de taxa, timeout). Repassar o motivo ajuda muito mais que um 500
    // genérico. `502` porque o Core funcionou; foi o provider que falhou.
    const providerFailure = error instanceof MiaAIError;

    console.error(
      `[Core] Erro ao processar mensagem de ${userId}:`,
      providerFailure ? `[Mia AI] ${error.message}` : error,
    );

    // Marca a conversa em erro para que a interface ofereça retry. O escopo
    // por usuário garante que só a conversa de quem falhou mude de estado.
    try {
      await setConversationState(userId, 'error');
    } catch {
      // Sem banco disponível não há estado para marcar; o status abaixo é o
      // suficiente para a interface tratar a falha.
    }

    const response: ApiResponse = {
      success: false,
      error: providerFailure
        ? (error as MiaAIError).message
        : 'Erro interno ao processar mensagem',
    };

    return c.json(response, providerFailure ? 502 : 500);
  }
});
