import { Body, Controller, Post, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { Identity } from '../common/decorators/identity.decorator.js';
import { IdentityGuard, type RequestIdentity } from '../middleware/identity.js';
import type { ApiResponse } from '../models/api-response.js';
import {
  validateChatRequest,
  type ChatRequest,
} from '../models/chat-request.js';
import {
  validateChatResponse,
  type ChatResponse,
} from '../models/chat-response.js';
import { formatChatConfig } from '../models/chat-config.js';
import { HostIntegrationError } from '../models/host-integration.js';
import type { Message } from '../models/message.js';
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
import {
  AIError,
  buildContext,
  sendToAI,
  withHostContext,
} from '../services/ai/index.js';
import { isHostContextEnabled } from '../services/host/host-context.config.js';
import { HostContextService } from '../services/host/host-context.service.js';
import {
  hostErrorHttpStatus,
  hostErrorMessage,
} from '../services/host/host-error-response.js';

@Controller('api/messages')
@UseGuards(IdentityGuard)
export class MessagesController {
  constructor(private readonly hostContext: HostContextService) {}

  private sanitizeForLog(value: unknown): string {
    return String(value).replace(/[\r\n]+/g, ' ');
  }

  @Post()
  async create(
    @Identity() identity: RequestIdentity,
    @Body() parsed: unknown,
    @Res() response: Response,
  ): Promise<Response> {
    const { userId, tenantId } = identity;
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

    const requestValidation = validateChatRequest(parsed);
    if (!requestValidation.ok) {
      const body: ApiResponse = {
        success: false,
        error: requestValidation.error,
      };
      return response.status(400).json(body);
    }

    const input: ChatRequest = requestValidation.data;
    const activeConfig = requestValidation.data.config;

    const message: Message = {
      message_id: input.message_id,
      message: input.message,
      metadata: input.metadata,
      origin: input.origin,
      date: input.date || new Date().toISOString(),
    };

    try {
      const safeOriginForLog = message.origin.replace(/[\r\n]/g, '');
      const safeMessageIdForLog = this.sanitizeForLog(message.message_id);
      console.log(
        '[Core] Mensagem recebida de %s (usuário %s):',
        safeOriginForLog,
        userId,
        safeMessageIdForLog,
        `· tenant ${tenantId ?? 'default'}`,
        `· config ${formatChatConfig(chatConfig.config)}`,
      );
      const conversation = await getOrCreateActiveConversation(userId);
      const hostContext = isHostContextEnabled()
        ? await this.hostContext.load({ userId, tenantId }, conversation.id)
        : undefined;
      const context = withHostContext(
        buildContext(
          conversation.id,
          conversation.state,
          conversation.messages,
          await getHistoryIds(userId),
        ),
        hostContext?.chat_context,
      );
      await appendMessage(message, 'user', conversation.id);
      await transitionConversationState(userId, 'streaming');
      const aiResponse = await sendToAI({
        message,
        context,
        config: activeConfig,
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

      const candidateResponse: ChatResponse = {
        request_id: input.request_id,
        conversation_id: conversation.id,
        message_id: message.message_id,
        ai_response: aiResponse.response,
        state: 'success',
        suggestions,
        config: activeConfig,
      };

      const responseValidation = validateChatResponse(candidateResponse);
      if (!responseValidation.ok) {
        const safeRequestIdForLog = input.request_id.replace(/[\r\n]+/g, ' ');
        console.error(
          '[Core] ChatResponse inválido gerado para %s (request_id=%s):',
          userId,
          safeRequestIdForLog,
          responseValidation.issues,
        );
        try {
          await transitionConversationState(userId, 'error');
        } catch {}
        const invalidBody: ApiResponse = {
          success: false,
          error: 'Erro interno ao formatar resposta do chat',
        };
        return response.status(500).json(invalidBody);
      }

      const body: ApiResponse<ChatResponse> = {
        success: true,
        data: responseValidation.data,
      };
      return response.status(200).json(body);
    } catch (error) {
      if (error instanceof HostIntegrationError) {
        // A falha do Host é explícita: a mensagem não é gravada nem respondida
        // com contexto vazio. O código é registrado, o conteúdo nunca.
        console.error(
          `[Core] Contexto do Host indisponível para ${this.sanitizeForLog(userId)}: ${this.sanitizeForLog(error.code)}`,
        );
        try {
          await transitionConversationState(userId, 'error');
        } catch {}
        const body: ApiResponse = {
          success: false,
          error: hostErrorMessage(error),
        };
        return response.status(hostErrorHttpStatus(error)).json(body);
      }

      const providerFailure = error instanceof AIError;
      console.error(
        `[Core] Erro ao processar mensagem de ${this.sanitizeForLog(userId)}:`,
        providerFailure ? `[AI] ${this.sanitizeForLog(error.message)}` : error,
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
