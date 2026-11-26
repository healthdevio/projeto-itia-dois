import { Body, Controller, Post, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import type { ApiResponse } from '../models/api-response.js';
import type { ChatRequest } from '../models/chat-request.js';
import { IdentityGuard, type IdentityRequest } from '../middleware/identity.js';
import { AIError } from '../services/ai/index.js';
import { MessageProcessingService } from '../services/message-processing/index.js';
import type { ChatResponse } from '../models/chat-response.js';
import { validateChatConfig } from '../models/chat-config.js';

@Controller('api/messages')
@UseGuards(IdentityGuard)
export class MessagesController {
  constructor(private readonly processing: MessageProcessingService) {}

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

    try {
      const result = await this.processing.processMessage(
        userId,
        input,
        tenantId,
      );

      const body: ApiResponse<ChatResponse> = {
        success: true,
        data: {
          request_id: input.request_id,
          conversation_id: result.conversation_id,
          message_id: result.message_id,
          ai_response: result.ai_response,
          state: result.state,
          suggestions: result.suggestions,
          config: result.config,
        },
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
        await this.processing.transitionToError(userId);
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
