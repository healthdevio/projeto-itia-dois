/**
 * Suggestion Routes
 *
 * Endpoints que entregam e registram as sugestões da conversa atual.
 *
 * Uma sugestão é a ação que a interface oferece abaixo da última resposta da
 * AI. Ela é **escrita pela AI** e **lida pela interface**; o Core é o
 * meio, e não decide o que é uma boa sugestão — ele não sabe o que é um
 * modelo de linguagem.
 *
 * Todos os endpoints exigem identidade (`X-User-Id`) e operam **apenas** nas
 * sugestões da conversa ativa de quem fez a requisição. Rotacionar a conversa
 * (`POST /api/conversations/rotate`) começa uma lista de sugestões nova, e a
 * antiga vai embora junto com a conversa.
 *
 * | Método   | Rota                 | Quem chama                        |
 * | -------- | -------------------- | --------------------------------- |
 * | `GET`    | `/api/suggestions`   | Interface, ao renderizar as chips |
 * | `POST`   | `/api/suggestions`   | Interface, ao registrar sugestão  |
 * | `DELETE` | `/api/suggestions`   | Interface, ao descartar as chips  |
 *
 * As sugestões que a AI devolve **junto de uma resposta** não passam por
 * aqui: elas são persistidas por `POST /api/messages`, que já conhece a
 * conversa em que a resposta foi gerada.
 */

import { Hono } from 'hono';

import { identity, type IdentityVariables } from '../middleware/identity.js';
import {
  addActiveSuggestions,
  clearActiveSuggestions,
  getActiveSuggestions,
} from '../repositories/suggestion-repository.js';
import type { ApiResponse } from '../models/message.js';
import { validateSuggestions, type Suggestion } from '../models/suggestion.js';

export const suggestionRoutes = new Hono<{ Variables: IdentityVariables }>();

// Toda rota deste router exige identidade. Um 401 é devolvido antes de
// qualquer acesso ao banco.
suggestionRoutes.use('*', identity);

/**
 * Corpo das respostas de sucesso.
 *
 * A lista vem embrulhada em `suggestions` — e não solta no `data` — para o
 * cliente não precisar adivinhar se recebeu uma sugestão ou uma lista delas,
 * e para o envelope poder crescer sem quebrar a interface.
 */
interface SuggestionsResponseData {
  suggestions: Suggestion[];
}

/**
 * Sugestões da conversa atual.
 *
 * GET /api/suggestions
 *
 * Entrega à interface as sugestões da conversa ativa **do usuário**, na ordem em
 * que a AI as sugeriu.
 *
 * Nunca devolve `404`: se o usuário ainda não conversou, a conversa ativa é
 * criada e a resposta é uma lista vazia — que é o que a interface precisa para
 * não renderizar nada.
 *
 * Códigos de resposta:
 * - 200: Sugestões entregues com sucesso
 * - 401: Identidade ausente ou inválida
 * - 500: Erro interno (banco indisponível, por exemplo)
 */
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

/**
 * Registra sugestões na conversa atual.
 *
 * POST /api/suggestions
 *
 * Acrescenta sugestões ao fim da lista da conversa ativa do usuário, sem
 * apagar o que já estava lá. É o caminho para a interface registrar uma
 * sugestão que não veio da AI — um atalho, uma ação de tela.
 *
 * O `suggestion_id` é opcional: quando falta, o Core gera um. Isso mantém o
 * trabalho de id com quem tem contexto de id (`src/models/suggestion.ts`).
 *
 * Aceita as duas formas:
 *
 * ```json
 * { "suggestions": [{ "text": "Ver meus detalhes" }] }
 * { "text": "Ver meus detalhes" }
 * ```
 *
 * Códigos de resposta:
 * - 200: Sugestões registradas com sucesso
 * - 400: JSON inválido, lista vazia, mais de 8 sugestões ou `text` inválido
 * - 401: Identidade ausente ou inválida
 * - 500: Erro interno
 */
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

/**
 * Descarta as sugestões da conversa atual.
 *
 * DELETE /api/suggestions
 *
 * Limpa a lista da conversa ativa **do usuário**. É o que a interface chama
 * depois que o usuário clica numa sugestão e envia a mensagem: as chips
 * antigas deixaram de fazer sentido, e a próxima resposta da AI trará as
 * novas.
 *
 * Nenhuma outra conversa é afetada. Sem sugestões para remover, a resposta é
 * `200` com `deleted: 0` — apagar de uma lista vazia não é erro.
 *
 * Códigos de resposta:
 * - 200: Sugestões removidas com sucesso
 * - 401: Identidade ausente ou inválida
 * - 500: Erro interno
 */
suggestionRoutes.delete('/', async (c) => {
  const userId = c.get('userId');

  try {
    const deleted = await clearActiveSuggestions(userId);

    const response: ApiResponse<{ deleted: number }> = {
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
