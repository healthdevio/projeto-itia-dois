import { Hono } from 'hono';
import { identity, type IdentityVariables } from '../middleware/identity.js';
import {
  addActiveSuggestions,
  clearActiveSuggestions,
  getActiveSuggestions,
} from '../repositories/suggestion-repository.js';
import type { ApiResponse } from '../models/message.js';
import { validateSuggestions, type Suggestion } from '../models/suggestion.js';
export const suggestionRoutes = new Hono<{
  Variables: IdentityVariables;
}>();
suggestionRoutes.use('*', identity);
interface SuggestionsResponseData {
  suggestions: Suggestion[];
}
suggestionRoutes.get('/', async (c) => {
  const userId = c.get('userId');
  try {
    const suggestions = await getActiveSuggestions(userId);
    const response: ApiResponse<SuggestionsResponseData> = {
      success: true,
      data: { suggestions },
    };
    return c.json(response, 200);
  } catch (error) {
    console.error(`[Core] Erro ao obter sugestões de ${userId}:`, error);
    const response: ApiResponse = {
      success: false,
      error: 'Erro interno ao obter as sugestões',
    };
    return c.json(response, 500);
  }
});
suggestionRoutes.post('/', async (c) => {
  const userId = c.get('userId');
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    const response: ApiResponse = {
      success: false,
      error: 'JSON inválido no corpo da requisição',
    };
    return c.json(response, 400);
  }
  const validation = validateSuggestions(body);
  if (!validation.ok) {
    const response: ApiResponse = {
      success: false,
      error: validation.error,
    };
    return c.json(response, 400);
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
    const response: ApiResponse<SuggestionsResponseData> = {
      success: true,
      data: { suggestions },
    };
    return c.json(response, 200);
  } catch (error) {
    console.error(`[Core] Erro ao registrar sugestões de ${userId}:`, error);
    const response: ApiResponse = {
      success: false,
      error: 'Erro interno ao registrar as sugestões',
    };
    return c.json(response, 500);
  }
});
suggestionRoutes.delete('/', async (c) => {
  const userId = c.get('userId');
  try {
    const deleted = await clearActiveSuggestions(userId);
    const response: ApiResponse<{
      deleted: number;
    }> = {
      success: true,
      data: { deleted },
    };
    return c.json(response, 200);
  } catch (error) {
    console.error(`[Core] Erro ao remover sugestões de ${userId}:`, error);
    const response: ApiResponse = {
      success: false,
      error: 'Erro interno ao remover as sugestões',
    };
    return c.json(response, 500);
  }
});
