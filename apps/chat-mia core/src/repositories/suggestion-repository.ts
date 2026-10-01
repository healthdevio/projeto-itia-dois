/**
 * Suggestion Repository
 *
 * Único ponto de acesso do Core às sugestões persistidas.
 *
 * **Todo método exige um `userId`**, igual ao `conversation-repository.ts`, e
 * pelo mesmo motivo: a única forma de alcançar uma sugestão é pela conversa
 * ativa **de quem fez a requisição**. O `conversation_id` nunca vem do corpo da
 * requisição — ele é resolvido aqui, a partir de uma busca escopada por
 * usuário. Um cliente não consegue, portanto, escrever ou ler as sugestões de
 * outra pessoa, nem passando um id de conversa no payload.
 *
 * As sugestões são escritas pela Mia AI (repassadas por
 * `POST /api/messages`) e pela interface (`POST /api/suggestions`), e lidas
 * pela interface (`GET /api/suggestions`).
 */

import { and, asc, eq, lt } from 'drizzle-orm';

import { getDatabase } from '../db/client.js';
import { suggestions } from '../db/schema.js';
import { getOrCreateActiveConversation } from './conversation-repository.js';
import { MAX_SUGGESTIONS, type Suggestion } from '../models/suggestion.js';

/**
 * Id da conversa ativa do usuário.
 *
 * Criada se ainda não existir, como em `GET /api/conversations/current`: a
 * interface nunca recebe erro por "conversa inexistente", e sim uma lista
 * vazia de sugestões.
 */
async function activeConversationId(userId: string): Promise<string> {
  const conversation = await getOrCreateActiveConversation(userId);
  return conversation.id;
}

/**
 * Converte uma linha do banco em `Suggestion`.
 */
function toSuggestion(row: typeof suggestions.$inferSelect): Suggestion {
  return {
    suggestion_id: row.suggestionId,
    text: row.text,
  };
}

/**
 * Lê as sugestões da conversa ativa de um usuário.
 *
 * A ordem devolvida é a mesma em que a Mia AI sugeriu (`position`), e não a
 * de inserção: assim a interface renderiza as chips na ordem em que a IA as
 * pensou, independentemente de quando cada linha entrou.
 *
 * @param userId - Dono da conversa
 * @param limit - Teto de sugestões devolvidas
 */
export async function getActiveSuggestions(
  userId: string,
  limit = MAX_SUGGESTIONS,
): Promise<Suggestion[]> {
  const conversationId = await activeConversationId(userId);

  const rows = await getDatabase()
    .select()
    .from(suggestions)
    .where(eq(suggestions.conversationId, conversationId))
    .orderBy(asc(suggestions.position), asc(suggestions.suggestionId))
    .limit(limit);

  return rows.map(toSuggestion);
}

/**
 * Insere sugestões no fim da lista da conversa ativa.
 *
 * Usado por `POST /api/suggestions`. `position` continua depois da última
 * suggestion já gravada, de modo que o acréscimo não embaralha a ordem do que
 * a Mia AI havia sugerido antes.
 *
 * Ids repetidos dentro da conversa são ignorados (`ON CONFLICT DO NOTHING`):
 * reenviar a mesma requisição não duplica as chips na interface.
 *
 * A lista da conversa é limitada a `MAX_SUGGESTIONS`. Ao estourar, as mais
 * antigas saem — a interface está sempre olhando para o mesmo tamanho de lista,
 * e as sugestões que ela acabou de registrar não podem ser as que somem da
 * tela por terem sido empurradas para fora do limite.
 *
 * @param userId - Dono da conversa
 * @param incoming - Sugestões a acrescentar
 * @returns As sugestões que ficaram na conversa ativa, na ordem exibida.
 */
export async function addActiveSuggestions(
  userId: string,
  incoming: Suggestion[],
): Promise<Suggestion[]> {
  const conversationId = await activeConversationId(userId);

  if (incoming.length === 0) return getActiveSuggestions(userId);

  const db = getDatabase();

  // A posição da próxima suggestion é o maior `position` atual + 1. Ler antes
  // de inserir evita depender de uma sequência no Postgres, que mudaria entre
  // chamadas e quebraria a ordem exibida.
  const existing = await db
    .select({ position: suggestions.position })
    .from(suggestions)
    .where(eq(suggestions.conversationId, conversationId));

  const lastPosition = existing.reduce(
    (max, row) => Math.max(max, row.position),
    -1,
  );
  const added = incoming.slice(0, MAX_SUGGESTIONS);

  await db
    .insert(suggestions)
    .values(
      added.map((suggestion, index) => ({
        conversationId,
        suggestionId: suggestion.suggestion_id,
        text: suggestion.text,
        position: lastPosition + 1 + index,
      })),
    )
    .onConflictDoNothing();

  // Descarta as que sobraram do teto. A posição mais antiga que continua é a
  // última das `MAX_SUGGESTIONS`; abaixo dela, sai. `ON CONFLICT DO NOTHING`
  // pode deixar buracos na sequência, e tudo bem: o corte é por posição, não
  // por contagem.
  const oldestKept = lastPosition + added.length - MAX_SUGGESTIONS + 1;

  if (oldestKept > 0) {
    await db
      .delete(suggestions)
      .where(
        and(
          eq(suggestions.conversationId, conversationId),
          lt(suggestions.position, oldestKept),
        ),
      );
  }

  return getActiveSuggestions(userId);
}

/**
 * Substitui as sugestões da conversa ativa.
 *
 * Usado a cada resposta da Mia AI: as sugestões da resposta anterior deixam de
 * valer, porque o contexto já mudou. Uma lista vazia limpa a conversa — é o
 * que a Mia AI respondeu ao mandar `suggestions: []`.
 *
 * @param userId - Dono da conversa
 * @param incoming - Sugestões da resposta da Mia AI
 * @returns As sugestões que ficaram na conversa ativa, na ordem exibida.
 */
export async function replaceActiveSuggestions(
  userId: string,
  incoming: Suggestion[],
): Promise<Suggestion[]> {
  const conversationId = await activeConversationId(userId);
  const db = getDatabase();

  const replacement = incoming.slice(0, MAX_SUGGESTIONS);

  await db
    .delete(suggestions)
    .where(eq(suggestions.conversationId, conversationId));

  if (replacement.length > 0) {
    await db.insert(suggestions).values(
      replacement.map((suggestion, position) => ({
        conversationId,
        suggestionId: suggestion.suggestion_id,
        text: suggestion.text,
        position,
      })),
    );
  }

  return replacement;
}

/**
 * Remove as sugestões da conversa ativa.
 *
 * Usado por `DELETE /api/suggestions`.
 *
 * @param userId - Dono da conversa
 * @returns Quantas sugestões foram removidas.
 */
export async function clearActiveSuggestions(userId: string): Promise<number> {
  const conversationId = await activeConversationId(userId);

  const deleted = await getDatabase()
    .delete(suggestions)
    .where(eq(suggestions.conversationId, conversationId))
    .returning({ suggestionId: suggestions.suggestionId });

  return deleted.length;
}
