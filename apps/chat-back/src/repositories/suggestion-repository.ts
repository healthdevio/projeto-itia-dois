import { and, asc, eq, lt } from 'drizzle-orm';
import { getDatabase } from '../db/client.js';
import { suggestions } from '../db/schema.js';
import { getOrCreateActiveConversation } from './conversation-repository.js';
import { MAX_SUGGESTIONS, type Suggestion } from '../models/suggestion.js';
async function activeConversationId(userId: string): Promise<string> {
  const conversation = await getOrCreateActiveConversation(userId);
  return conversation.id;
}
function toSuggestion(row: typeof suggestions.$inferSelect): Suggestion {
  return {
    suggestion_id: row.suggestionId,
    text: row.text,
  };
}
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
export async function addActiveSuggestions(
  userId: string,
  incoming: Suggestion[],
): Promise<Suggestion[]> {
  const conversationId = await activeConversationId(userId);
  if (incoming.length === 0) return getActiveSuggestions(userId);
  const db = getDatabase();
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
export async function clearActiveSuggestions(userId: string): Promise<number> {
  const conversationId = await activeConversationId(userId);
  const deleted = await getDatabase()
    .delete(suggestions)
    .where(eq(suggestions.conversationId, conversationId))
    .returning({ suggestionId: suggestions.suggestionId });
  return deleted.length;
}
