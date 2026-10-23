import { Hono } from 'hono';
import { identity, type IdentityVariables } from '../middleware/identity.js';
import { AIError, buildContext, sendToAI } from '../services/ai/index.js';
import {
  appendMessage,
  getHistoryIds,
  getOrCreateActiveConversation,
  transitionConversationState,
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
import type { ConversationState } from '../models/conversation.js';
import type { Suggestion } from '../models/suggestion.js';
export const messageRoutes = new Hono<{
  Variables: IdentityVariables;
}>();
messageRoutes.use('*', identity);
interface MessageRequestBody extends Message {
  config?: ChatConfigInput;
}
interface MessageResponseData {
  message_id: string;
  ai_response: string;
  state: ConversationState;
  suggestions: Suggestion[];
  config: ChatConfig;
}
messageRoutes.post('/', async (c) => {
  const userId = c.get('userId');
  const tenantId = c.get('tenantId');
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
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    const response: ApiResponse = {
      success: false,
      error: 'Corpo da requisição inválido',
    };
    return c.json(response, 400);
  }
  const body = parsed as MessageRequestBody;
  const chatConfig = validateChatConfig(body.config);
  if (!chatConfig.ok) {
    const response: ApiResponse = {
      success: false,
      error: chatConfig.error,
    };
    return c.json(response, 400);
  }
  try {
    if (!body.message_id || !body.message || !body.origin) {
      const response: ApiResponse = {
        success: false,
        error: 'Campos obrigatórios faltando: message_id, message, origin',
      };
      return c.json(response, 400);
    }
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
    const conversation = await getOrCreateActiveConversation(userId);
    const context = buildContext(
      conversation.id,
      conversation.state,
      conversation.messages,
      await getHistoryIds(userId),
    );
    await appendMessage(message, 'user', conversation.id);
    await transitionConversationState(userId, 'streaming');
    const aiResponse = await sendToAI({
      message,
      context,
      config: chatConfig.config,
      tenant: tenantId,
    });
    const aiMessage: Message = {
      message_id: `${message.message_id}-ai`,
      message: aiResponse.response,
      date: new Date().toISOString(),
      origin: 'ai',
    };
    await appendMessage(aiMessage, 'assistant', conversation.id);
    const suggestions =
      aiResponse.suggestions === null
        ? await getActiveSuggestions(userId)
        : await replaceActiveSuggestions(userId, aiResponse.suggestions);
    await transitionConversationState(userId, 'success');
    const response: ApiResponse<MessageResponseData> = {
      success: true,
      data: {
        message_id: message.message_id,
        ai_response: aiResponse.response,
        state: 'success',
        suggestions,
        config: chatConfig.config,
      },
    };
    return c.json(response, 200);
  } catch (error) {
    const providerFailure = error instanceof AIError;
    console.error(
      `[Core] Erro ao processar mensagem de ${userId}:`,
      providerFailure ? `[AI] ${error.message}` : error,
    );
    try {
      await transitionConversationState(userId, 'error');
    } catch {}
    const response: ApiResponse = {
      success: false,
      error: providerFailure
        ? (error as AIError).message
        : 'Erro interno ao processar mensagem',
    };
    return c.json(response, providerFailure ? 502 : 500);
  }
});
