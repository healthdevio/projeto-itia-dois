/**
 * Message Routes
 *
 * Endpoint que recebe mensagens da interface e as repassa para a Mia AI.
 *
 * Diferente da conversa, a mensagem é o único dado que sai do Core. A cada
 * envio, o Core também carrega o contexto da conversa — as mensagens
 * anteriores e os ids do histórico — para que a Mia AI responda com
 * consciência do diálogo. A conversa em si nunca é enviada.
 */

import { Hono } from 'hono';

import { identity, type IdentityVariables } from '../middleware/identity.js';
import { buildContext, sendToMiaAI } from '../services/mia-ai.js';
import {
  appendMessage,
  getOrCreateActiveConversation,
  setConversationState,
} from '../repositories/conversation-repository.js';
import type { ApiResponse, Message } from '../models/message.js';

export const messageRoutes = new Hono<{ Variables: IdentityVariables }>();

// Toda rota deste router exige identidade.
messageRoutes.use('*', identity);

/**
 * Resposta do endpoint de mensagens.
 */
interface MessageResponseData {
  message_id: string;
  mia_ai_response: string;
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
 * Códigos de resposta:
 * - 200: Sucesso
 * - 400: JSON inválido ou campos obrigatórios faltando
 * - 401: Identidade ausente ou inválida
 * - 500: Erro interno
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
      [], // TODO: carregar os ids do histórico deste usuário aqui
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

    await setConversationState(userId, 'idle');

    const response: ApiResponse<MessageResponseData> = {
      success: true,
      data: {
        message_id: message.message_id,
        mia_ai_response: miaResponse.response,
      },
    };

    return c.json(response, 200);
  } catch (error) {
    console.error(`[Core] Erro ao processar mensagem de ${userId}:`, error);

    // Marca a conversa em erro para que a interface ofereça retry. O escopo
    // por usuário garante que só a conversa de quem falhou mude de estado.
    try {
      await setConversationState(userId, 'error');
    } catch {
      // Sem banco disponível não há estado para marcar; o 500 abaixo é o
      // suficiente para a interface tratar a falha.
    }

    const response: ApiResponse = {
      success: false,
      error: 'Erro interno ao processar mensagem',
    };

    return c.json(response, 500);
  }
});
