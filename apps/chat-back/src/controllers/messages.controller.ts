import { Body, Controller, Inject, Post, Res, UseGuards } from '@nestjs/common';
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
import { HostIntegrationError } from '../models/host-integration.js';
import { AIError } from '../services/ai/index.js';
import { MessageProcessingService } from '../services/message-processing/index.js';
import {
  hostErrorHttpStatus,
  hostErrorMessage,
} from '../services/host/host-error-response.js';
import { sanitizeForLog } from '../utils/sanitize-for-log.js';

@Controller('api/messages')
@UseGuards(IdentityGuard)
export class MessagesController {
  constructor(
    @Inject(MessageProcessingService)
    private readonly processing: MessageProcessingService,
  ) {}

  private sanitizeHeaderValue(value: string): string {
    return value.replace(/[\r\n]+/g, '');
  }

  @Post()
  async create(
    @Identity() identity: RequestIdentity,
    @Body() parsed: unknown,
    @Res() response: Response,
  ): Promise<Response> {
    const { userId, tenantId } = identity;

    const requestValidation = validateChatRequest(parsed);
    if (!requestValidation.ok) {
      const body: ApiResponse = {
        success: false,
        error: requestValidation.error,
      };
      return response.status(400).json(body);
    }

    const input: ChatRequest = requestValidation.data;
    response.setHeader(
      'X-Request-Id',
      this.sanitizeHeaderValue(input.request_id),
    );

    const abortController = new AbortController();
    const handleClose = () => {
      if (!response.writableEnded) {
        abortController.abort();
      }
    };
    response.on('close', handleClose);

    try {
      const result = await this.processing.processMessage(
        userId,
        input,
        tenantId,
        undefined,
        abortController.signal,
      );

      const candidateResponse: ChatResponse = {
        request_id: input.request_id,
        conversation_id: result.conversation_id,
        message_id: result.message_id,
        ai_response: result.ai_response,
        state: result.state,
        suggestions: result.suggestions,
        config: result.config,
      };

      const responseValidation = validateChatResponse(candidateResponse);
      if (!responseValidation.ok) {
        console.error(
          '[Core] ChatResponse inválido gerado: %s',
          JSON.stringify({
            userId: sanitizeForLog(userId),
            requestId: sanitizeForLog(input.request_id),
            issues: responseValidation.issues.map((issue) => ({
              path: sanitizeForLog(issue.path),
              message: sanitizeForLog(issue.message),
            })),
          }),
        );
        try {
          await this.processing.transitionToError(userId);
        } catch {}
        const body: ApiResponse = {
          success: false,
          error: 'Erro interno ao formatar resposta do chat',
        };
        return response.status(500).json(body);
      }

      const body: ApiResponse<ChatResponse> = {
        success: true,
        data: responseValidation.data,
      };
      return response.status(200).json(body);
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.warn(
          '[Core] Requisição REST cancelada pelo cliente: %s',
          JSON.stringify({
            userId: sanitizeForLog(userId),
            requestId: sanitizeForLog(input.request_id),
          }),
        );
        try {
          await this.processing.transitionToError(userId);
        } catch {}
        if (response.writableEnded) {
          return response;
        }
        const body: ApiResponse = {
          success: false,
          error: 'Requisição cancelada pelo cliente',
        };
        return response.status(499).json(body);
      }

      if (error instanceof HostIntegrationError) {
        // A falha do Host é explícita: a mensagem não é gravada nem respondida
        // com contexto vazio. O código é registrado, o conteúdo nunca.
        console.error(
          '[Core] Contexto do Host indisponível: %s',
          JSON.stringify({
            userId: sanitizeForLog(userId),
            code: sanitizeForLog(error.code),
          }),
        );
        try {
          await this.processing.transitionToError(userId);
        } catch {}
        const body: ApiResponse = {
          success: false,
          error: hostErrorMessage(error),
        };
        return response.status(hostErrorHttpStatus(error)).json(body);
      }

      const providerFailure = error instanceof AIError;
      console.error(
        '[Core] Erro ao processar mensagem: %s',
        JSON.stringify({
          userId: sanitizeForLog(userId),
          error: providerFailure
            ? `[AI] ${sanitizeForLog(error.message)}`
            : sanitizeForLog(error),
        }),
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
    } finally {
      response.off('close', handleClose);
    }
  }
}
