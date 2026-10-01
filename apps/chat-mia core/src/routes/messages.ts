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
 * A resposta da Mia AI pode vir acompanhada de `suggestions` (ver
 * `src/services/mia-ai.ts`). Quando vem, o Core substitui as sugestões da
 * conversa ativa pelas novas e as devolve junto da resposta, para a interface
 * renderizar as chips sem uma segunda chamada.
 */

import { Hono } from 'hono';

import { identity, type IdentityVariables } from '../middleware/identity.js';
import { MiaAIError, buildContext, sendToMiaAI } from '../services/mia-ai.js';
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
import type { ApiResponse, Message } from '../models/message.js';
import type { Suggestion } from '../models/suggestion.js';

export const messageRoutes = new Hono<{ Variables: IdentityVariables }>();

// Toda rota deste router exige identidade.
messageRoutes.use('*', identity);

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
}

/**
 * Endpoint para receber mensagens da interface
 *
 * POST /api/messages
 *
 * Recebe uma mensagem do frontend, valida, persiste na conversa ativa **do
 * usuário que fez a requisição** e repassa para a Mia AI com o contexto
 * acumulado.
 *
 * A resposta traz também `suggestions`: as sugestões que a Mia AI devolveu com
 * a resposta, já gravadas na conversa. A interface renderiza as chips direto
 * dali, sem precisar de `GET /api/suggestions` logo em seguida.
 *
 * Códigos de resposta:
 * - 200: Sucesso
 * - 400: JSON inválido ou campos obrigatórios faltando
 * - 401: Identidade ausente ou inválida
 * - 500: Erro interno
 * - 502: A Mia AI falhou (chave inválida, limite de taxa, timeout). O corpo
 *   traz o motivo do provider; a interface usa isso para oferecer retry.
 */
messageRoutes.post('/', async (c) => {
  const userId = c.get('userId');

  try {
    const body = await c.req.json<Message>();

    // Validação dos campos obrigatórios
    if (!body.message_id || !body.message || !body.origin) {
      const response: ApiResponse = {
        success: false,
        error: 'Campos obrigatórios faltando: message_id, message, origin',
      };
      return c.json(response, 400);
    }

    // Adiciona data se não fornecida
    const message: Message = {
      ...body,
      date: body.date || new Date().toISOString(),
    };

    console.log(
      `[Core] Mensagem recebida de ${message.origin} (usuário ${userId}):`,
      message.message_id,
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
    // não.
    const miaResponse = await sendToMiaAI({ message, context });

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
      },
    };

    return c.json(response, 200);
  } catch (error) {
    // Erro do provider da Mia AI tem causa conhecida (chave inválida, limite
    // de taxa, timeout). Repassar o motivo ajuda muito mais que um 500
    // genérico. `502` porque o Core funcionou; foi o upstream que falhou.
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
