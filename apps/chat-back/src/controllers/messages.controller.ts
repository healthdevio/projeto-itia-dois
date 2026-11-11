import { Body, Controller, Post, Req, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { formatChatConfig, validateChatConfig } from '../models/chat-config.js';
import type { ApiResponse } from '../models/api-response.js';
import type { Message } from '../models/message.js';
import type { ChatRequest } from '../models/chat-request.js';
import { IdentityGuard, type IdentityRequest } from '../middleware/identity.js';
import {
  appendMessage,
  getHistoryIds,
  getOrCreateActiveConversation,
  transitionConversationState,
} from '../repositories/conversation-repository.js';
import {
  getActiveSuggestions,
  replaceActiveSuggestions,
} from '../repositories/suggestion-repository.js';
import { AIError, buildContext, sendToAI } from '../services/ai/index.js';
import type { ChatResponse } from '../models/chat-response.js';

@Controller('api/messages')
@UseGuards(IdentityGuard)
export class MessagesController {
  @Post()
  async create(
    @Req() request: IdentityRequest,
    @Body() parsed: unknown,
    @Res() response: Response,
  ): Promise<Response> {
    const { userId, tenantId } = request.identity!;
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      Array.isArray(parsed)
    ) {
      const body: ApiResponse = {
        success: false,
        error: 'Corpo da requisição inválido',
      };
      return response.status(400).json(body);
    }

    const input = parsed as ChatRequest;
    const chatConfig = validateChatConfig(input.config);
    if (!chatConfig.ok) {
      const body: ApiResponse = { success: false, error: chatConfig.error };
      return response.status(400).json(body);
    }

    if (
      typeof input.message_id !== 'string' ||
      !input.message_id ||
      typeof input.message !== 'string' ||
      !input.message ||
      typeof input.origin !== 'string' ||
      !input.origin
    ) {
      const body: ApiResponse = {
        success: false,
        error: 'Campos obrigatórios faltando: message_id, message, origin',
      };
      return response.status(400).json(body);
    }

    const message: Message = {
      message_id: input.message_id,
      message: input.message,
      metadata: input.metadata,
      origin: input.origin,
      date: input.date || new Date().toISOString(),
    };

    try {
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
      const body: ApiResponse<ChatResponse> = {
        success: true,
        data: {
          message_id: message.message_id,
          ai_response: aiResponse.response,
          state: 'success',
          suggestions,
          config: chatConfig.config,
        },
      };
      return response.status(200).json(body);
    } catch (error) {
      const providerFailure = error instanceof AIError;
      console.error(
        `[Core] Erro ao processar mensagem de ${userId}:`,
        providerFailure ? `[AI] ${error.message}` : error,
      );
      try {
        await transitionConversationState(userId, 'error');
      } catch {}
      const body: ApiResponse = {
        success: false,
        error: providerFailure
          ? error.message
          : 'Erro interno ao processar mensagem',
      };
      return response.status(providerFailure ? 502 : 500).json(body);
    }
  }
}
