import {
  Controller,
  Get,
  Post,
  Body,
  Req,
  Res,
  UseGuards,
  Inject,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';
import type { ApiResponse } from '../models/api-response.js';
import type { ChatRequest } from '../models/chat-request.js';
import type { ChatResponse } from '../models/chat-response.js';
import { IdentityGuard, type IdentityRequest } from '../middleware/identity.js';
import { SseService } from '../services/sse/sse.service.js';
import { SseBroadcaster } from '../services/sse/broadcaster.js';
import { SseResponseChannel } from '../services/sse/channel.js';

/**
 * Controller de Server-Sent Events (SSE) do chat.
 *
 * Expõe dois endpoints:
 *
 * - `GET /api/chat/stream` — abre uma conexão SSE persistente. O cliente fica
 *   escutando eventos até encerrar a conexão. O id da conexão é enviado no
 *   primeiro evento (`connection.opened`) e deve ser usado pelo cliente nas
 *   requisições de mensagem.
 * - `POST /api/chat/stream/:connectionId/message` — recebe um `ChatRequest`,
 *   processa via `SseService` e envia eventos progressivos (delta de resposta)
 *   e o `ChatResponse` final pelo canal SSE da conexão informada.
 *
 * Os eventos seguem o protocolo SSE (`event:`, `data:`, `id:`) e seus tipos
 * estão alinhados ao fluxo de processamento da Mia AI:
 * `connection.opened`, `conversation.started`, `conversation.state`,
 * `ai.delta`, `ai.complete`, `ai.error`, `connection.closed`.
 */
@Controller('api/chat/stream')
@UseGuards(IdentityGuard)
export class SseController implements OnModuleDestroy {
  private readonly logger = new Logger(SseController.name);

  constructor(
    @Inject(SseService) private readonly sseService: SseService,
    @Inject(SseBroadcaster) private readonly broadcaster: SseBroadcaster,
  ) {}

  /**
   * Abre uma nova conexão SSE.
   *
   * A resposta HTTP é mantida aberta (text/event-stream) e os eventos são
   * enviados progressivamente pelo canal da conexão. O cliente deve manter a
   * conexão aberta para receber os eventos do processamento da mensagem.
   */
  @Get()
  async open(
    @Req() request: IdentityRequest,
    @Res() response: Response,
  ): Promise<void> {
    const { userId } = request.identity!;
    const channel = new SseResponseChannel(response);
    const connectionId = this.sseService.openConnection(channel, userId);

    // Remove a conexão do broadcaster quando o cliente encerra a resposta.
    response.on('close', () => {
      this.sseService.closeConnection(connectionId);
      this.logger.debug(
        `Cliente desconectado do SSE (usuário ${userId}, conexão ${connectionId})`,
      );
    });

    this.logger.log(
      `Conexão SSE aberta para o usuário ${userId}: ${connectionId}`,
    );
  }

  /**
   * Recebe uma mensagem de chat e processa via SSE na conexão informada.
   *
   * O corpo deve ser um `ChatRequest` válido. O processamento é delegado ao
   * `SseService`, que escreve os eventos no canal SSE da conexão. O endpoint
   * responde imediatamente com 202 (aceito) e os eventos chegam de forma
   * progressiva pelo canal aberto.
   */
  @Post(':connectionId/message')
  async sendMessage(
    @Req() request: IdentityRequest,
    @Body() parsed: unknown,
    @Res() response: Response,
  ): Promise<Response> {
    const { userId } = request.identity!;
    const { connectionId } = request.params as { connectionId: string };

    if (!this.broadcaster.has(connectionId)) {
      const body: ApiResponse = {
        success: false,
        error: 'Conexão SSE não encontrada ou já encerrada',
      };
      return response.status(404).json(body);
    }

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

    const chatRequest = parsed as ChatRequest;

    // Dispara o processamento de forma assíncrona. Os eventos são enviados
    // pelo canal SSE; este endpoint apenas confirma o recebimento da requisição.
    this.sseService
      .streamMessage(userId, chatRequest, connectionId)
      .then((chatResponse: ChatResponse) => {
        this.logger.log(
          `Mensagem processada via SSE (usuário ${userId}, conexão ${connectionId}): ${chatResponse.message_id}`,
        );
      })
      .catch((error) => {
        this.logger.error(
          `Erro ao processar mensagem via SSE (usuário ${userId}, conexão ${connectionId}):`,
          error instanceof Error ? error.stack : String(error),
        );
      });

    const body: ApiResponse<{ connectionId: string }> = {
      success: true,
      data: { connectionId },
      // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    } as ApiResponse<{ connectionId: string }>;
    return response.status(202).json(body);
  }

  async onModuleDestroy(): Promise<void> {
    await this.sseService.onModuleDestroy();
  }
}
