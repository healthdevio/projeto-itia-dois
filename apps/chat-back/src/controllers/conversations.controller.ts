import { Controller, Get, Post, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { Identity } from '../common/decorators/identity.decorator.js';
import { IdentityGuard, type RequestIdentity } from '../middleware/identity.js';
import type { ApiResponse } from '../models/api-response.js';
import type { Conversation, ConversationView } from '../models/conversation.js';
import {
  getConversationView,
  getOrCreateActiveConversation,
  rotateConversation,
} from '../repositories/conversation-repository.js';

@Controller('api/conversations')
@UseGuards(IdentityGuard)
export class ConversationsController {
  @Get('current')
  async current(
    @Identity() identity: RequestIdentity,
    @Res() response: Response,
  ): Promise<Response> {
    const { userId } = identity;
    try {
      const view: ConversationView = await getConversationView(userId);
      const body: ApiResponse<ConversationView> = { success: true, data: view };
      return response.status(200).json(body);
    } catch (error) {
      console.error(`[Core] Erro ao obter conversa atual de ${userId}:`, error);
      const body: ApiResponse = {
        success: false,
        error: 'Erro interno ao obter a conversa atual',
      };
      return response.status(500).json(body);
    }
  }

  @Get('active')
  async active(
    @Identity() identity: RequestIdentity,
    @Res() response: Response,
  ): Promise<Response> {
    const { userId } = identity;
    try {
      const conversation: Conversation =
        await getOrCreateActiveConversation(userId);
      const body: ApiResponse<Conversation> = {
        success: true,
        data: conversation,
      };
      return response.status(200).json(body);
    } catch (error) {
      console.error(`[Core] Erro ao obter conversa ativa de ${userId}:`, error);
      const body: ApiResponse = {
        success: false,
        error: 'Erro interno ao obter a conversa ativa',
      };
      return response.status(500).json(body);
    }
  }

  @Post('rotate')
  async rotate(
    @Identity() identity: RequestIdentity,
    @Res() response: Response,
  ): Promise<Response> {
    const { userId } = identity;
    try {
      const conversation = await rotateConversation(userId);
      console.log(
        `[Core] Nova conversa iniciada para ${userId}: ${conversation.id}`,
      );
      const body: ApiResponse<Conversation> = {
        success: true,
        data: conversation,
      };
      return response.status(200).json(body);
    } catch (error) {
      console.error(`[Core] Erro ao rotacionar conversa de ${userId}:`, error);
      const body: ApiResponse = {
        success: false,
        error: 'Erro interno ao iniciar nova conversa',
      };
      return response.status(500).json(body);
    }
  }
}
