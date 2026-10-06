/**
 * Conversation Routes
 *
 * Endpoints que entregam a conversa atual para a interface.
 *
 * Todos exigem identidade (`X-User-Id`) e operam **apenas** nas conversas do
 * usuário que fez a requisição.
 *
 * A conversa é estado interno do Core: nenhum destes endpoints repassa
 * qualquer coisa para a AI. Apenas `POST /api/messages` (ver
 * `src/routes/messages.ts`) fala com a AI, e o faz carregando o contexto
 * lido por este repositório.
 */

import { Hono } from 'hono';

import { identity, type IdentityVariables } from '../middleware/identity.js';
import {
  getConversationView,
  getOrCreateActiveConversation,
  rotateConversation,
} from '../repositories/conversation-repository.js';
import type { ApiResponse } from '../models/message.js';
import type { Conversation, ConversationView } from '../models/conversation.js';

export const conversationRoutes = new Hono<{ Variables: IdentityVariables }>();

// Toda rota deste router exige identidade. Um 401 é devolvido antes de
// qualquer acesso ao banco.
conversationRoutes.use('*', identity);

/**
 * Estado atual da conversa do usuário.
 *
 * GET /api/conversations/current
 *
 * Entrega à interface a conversa em andamento com suas mensagens, o estado
 * atual da máquina de estados e o histórico de conversas anteriores **dele**.
 *
 * Cria a conversa automaticamente na primeira chamada, de modo que a
 * interface nunca receba 404 e possa renderizar a tela de abertura.
 *
 * Códigos de resposta:
 * - 200: Conversa atual entregue com sucesso
 * - 401: Identidade ausente ou inválida
 * - 500: Erro interno (banco indisponível, por exemplo)
 */
conversationRoutes.get('/current', async (c) => {
  const userId = c.get('userId');

  try {
    const view: ConversationView = await getConversationView(userId);

    const response: ApiResponse<ConversationView> = {
      success: true,
      data: view,
    };

    return c.json(response, 200);
  } catch (error) {
    console.error(`[Core] Erro ao obter conversa atual de ${userId}:`, error);

    const response: ApiResponse = {
      success: false,
      error: 'Erro interno ao obter a conversa atual',
    };

    return c.json(response, 500);
  }
});

/**
 * Só a conversa ativa do usuário, sem histórico.
 *
 * GET /api/conversations/active
 *
 * Variante enxuta de `/current` para a interface que já mantém o histórico em
 * memória e só precisa sincronizar a conversa em andamento.
 *
 * Códigos de resposta:
 * - 200: Conversa ativa entregue com sucesso
 * - 401: Identidade ausente ou inválida
 * - 500: Erro interno
 */
conversationRoutes.get('/active', async (c) => {
  const userId = c.get('userId');

  try {
    const active: Conversation = await getOrCreateActiveConversation(userId);

    const response: ApiResponse<Conversation> = {
      success: true,
      data: active,
    };

    return c.json(response, 200);
  } catch (error) {
    console.error(`[Core] Erro ao obter conversa ativa de ${userId}:`, error);

    const response: ApiResponse = {
      success: false,
      error: 'Erro interno ao obter a conversa ativa',
    };

    return c.json(response, 500);
  }
});

/**
 * Inicia uma nova conversa para o usuário.
 *
 * POST /api/conversations/rotate
 *
 * Encerra a conversa em andamento do usuário — que passa a integrar o
 * `history` dele — e cria uma nova conversa ativa, já no estado `greeting`.
 * Não afeta a conversa de nenhum outro usuário.
 *
 * Códigos de resposta:
 * - 200: Nova conversa criada com sucesso
 * - 401: Identidade ausente ou inválida
 * - 500: Erro interno
 */
conversationRoutes.post('/rotate', async (c) => {
  const userId = c.get('userId');

  try {
    const active: Conversation = await rotateConversation(userId);

    console.log(`[Core] Nova conversa iniciada para ${userId}: ${active.id}`);

    const response: ApiResponse<Conversation> = {
      success: true,
      data: active,
    };

    return c.json(response, 200);
  } catch (error) {
    console.error(`[Core] Erro ao rotacionar conversa de ${userId}:`, error);

    const response: ApiResponse = {
      success: false,
      error: 'Erro interno ao iniciar nova conversa',
    };

    return c.json(response, 500);
  }
});
