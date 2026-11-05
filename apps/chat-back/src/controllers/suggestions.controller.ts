import {
  Body,
  Controller,
  Delete,
  Get,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import type { ApiResponse } from '../models/message.js';
import { validateSuggestions, type Suggestion } from '../models/suggestion.js';
import { IdentityGuard, type IdentityRequest } from '../middleware/identity.js';
import {
  addActiveSuggestions,
  clearActiveSuggestions,
  getActiveSuggestions,
} from '../repositories/suggestion-repository.js';

interface SuggestionsResponseData {
  suggestions: Suggestion[];
}

@Controller('api/suggestions')
@UseGuards(IdentityGuard)
export class SuggestionsController {
  @Get()
  async list(
    @Req() request: IdentityRequest,
    @Res() response: Response,
  ): Promise<Response> {
    const { userId } = request.identity!;
    try {
      const suggestions = await getActiveSuggestions(userId);
      const body: ApiResponse<SuggestionsResponseData> = {
        success: true,
        data: { suggestions },
      };
      return response.status(200).json(body);
    } catch (error) {
      console.error(`[Core] Erro ao obter sugestões de ${userId}:`, error);
      const body: ApiResponse = {
        success: false,
        error: 'Erro interno ao obter as sugestões',
      };
      return response.status(500).json(body);
    }
  }

  @Post()
  async add(
    @Req() request: IdentityRequest,
    @Body() body: unknown,
    @Res() response: Response,
  ): Promise<Response> {
    const { userId } = request.identity!;
    const validation = validateSuggestions(body);
    if (!validation.ok) {
      const result: ApiResponse = { success: false, error: validation.error };
      return response.status(400).json(result);
    }
    try {
      const suggestions = await addActiveSuggestions(
        userId,
        validation.suggestions,
      );
      console.log(
        `[Core] ${validation.suggestions.length} sugestão(ões) registrada(s) por ${userId}:`,
        suggestions.map((suggestion) => suggestion.text).join(' | '),
      );
      const result: ApiResponse<SuggestionsResponseData> = {
        success: true,
        data: { suggestions },
      };
      return response.status(200).json(result);
    } catch (error) {
      console.error(`[Core] Erro ao registrar sugestões de ${userId}:`, error);
      const result: ApiResponse = {
        success: false,
        error: 'Erro interno ao registrar as sugestões',
      };
      return response.status(500).json(result);
    }
  }

  @Delete()
  async clear(
    @Req() request: IdentityRequest,
    @Res() response: Response,
  ): Promise<Response> {
    const { userId } = request.identity!;
    try {
      const deleted = await clearActiveSuggestions(userId);
      const result: ApiResponse<{ deleted: number }> = {
        success: true,
        data: { deleted },
      };
      return response.status(200).json(result);
    } catch (error) {
      console.error(`[Core] Erro ao remover sugestões de ${userId}:`, error);
      const result: ApiResponse = {
        success: false,
        error: 'Erro interno ao remover as sugestões',
      };
      return response.status(500).json(result);
    }
  }
}
