import { Body, Controller, Post, Req, Res, UseGuards } from '@nestjs/common';
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

    try {
      const result = await this.processing.processMessage(
        userId,
        input,
        tenantId,
      );

      const body: ApiResponse<ChatResponse> = {
        success: true,
        data: {
          message_id: result.message_id,
          ai_response: result.ai_response,
          state: result.state,
          suggestions: result.suggestions,
          config: result.config,
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
