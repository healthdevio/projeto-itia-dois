import { Hono } from 'hono';
import { identity, type IdentityVariables } from '../middleware/identity.js';
import {
  getConversationView,
  getOrCreateActiveConversation,
  rotateConversation,
} from '../repositories/conversation-repository.js';
import type { ApiResponse } from '../models/message.js';
import type { Conversation, ConversationView } from '../models/conversation.js';
export const conversationRoutes = new Hono<{
  Variables: IdentityVariables;
}>();
conversationRoutes.use('*', identity);
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
