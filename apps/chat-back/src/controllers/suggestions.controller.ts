import {
  Body,
  Controller,
  Delete,
  Get,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { Identity } from '../common/decorators/identity.decorator.js';
import { IdentityGuard, type RequestIdentity } from '../middleware/identity.js';
import type { ApiResponse } from '../models/api-response.js';
import { validateSuggestions, type Suggestion } from '../models/suggestion.js';
import {
  addActiveSuggestions,
  clearActiveSuggestions,
  getActiveSuggestions,
} from '../repositories/suggestion-repository.js';
import { sanitizeForLog } from '../utils/sanitize-for-log.js';

interface SuggestionsResponseData {
  suggestions: Suggestion[];
}

@Controller('api/suggestions')
@UseGuards(IdentityGuard)
export class SuggestionsController {
  @Get()
  async list(
    @Identity() identity: RequestIdentity,
    @Res() response: Response,
  ): Promise<Response> {
    const { userId } = identity;
    try {
      const suggestions = await getActiveSuggestions(userId);
      const body: ApiResponse<SuggestionsResponseData> = {
        success: true,
        data: { suggestions },
      };
      return response.status(200).json(body);
    } catch (error) {
      console.error(
        '[Core] Erro ao obter sugestões: %s',
        JSON.stringify({
          userId: sanitizeForLog(userId),
          error: sanitizeForLog(error),
        }),
      );
      const body: ApiResponse = {
        success: false,
        error: 'Erro interno ao obter as sugestões',
      };
      return response.status(500).json(body);
    }
  }

  @Post()
  async add(
    @Identity() identity: RequestIdentity,
    @Body() body: unknown,
    @Res() response: Response,
  ): Promise<Response> {
    const { userId } = identity;
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
        '[Core] Sugestões registradas: %s',
        JSON.stringify({
          count: validation.suggestions.length,
          userId: sanitizeForLog(userId),
          suggestions: suggestions.map((suggestion) =>
            sanitizeForLog(suggestion.text),
          ),
        }),
      );
      const result: ApiResponse<SuggestionsResponseData> = {
        success: true,
        data: { suggestions },
      };
      return response.status(200).json(result);
    } catch (error) {
      console.error(
        '[Core] Erro ao registrar sugestões: %s',
        JSON.stringify({
          userId: sanitizeForLog(userId),
          error: sanitizeForLog(error),
        }),
      );
      const result: ApiResponse = {
        success: false,
        error: 'Erro interno ao registrar as sugestões',
      };
      return response.status(500).json(result);
    }
  }

  @Delete()
  async clear(
    @Identity() identity: RequestIdentity,
    @Res() response: Response,
  ): Promise<Response> {
    const { userId } = identity;
    try {
      const deleted = await clearActiveSuggestions(userId);
      const result: ApiResponse<{ deleted: number }> = {
        success: true,
        data: { deleted },
      };
      return response.status(200).json(result);
    } catch (error) {
      console.error(
        '[Core] Erro ao remover sugestões: %s',
        JSON.stringify({
          userId: sanitizeForLog(userId),
          error: sanitizeForLog(error),
        }),
      );
      const result: ApiResponse = {
        success: false,
        error: 'Erro interno ao remover as sugestões',
      };
      return response.status(500).json(result);
    }
  }
}
