import { randomUUID } from 'node:crypto';
import { and, asc, desc, eq } from 'drizzle-orm';
import { getDatabase } from '../db/client.js';
import { conversations, messages } from '../db/schema.js';
import type {
  Conversation,
  ConversationMessage,
  ConversationState,
  ConversationView,
  MessageRole,
} from '../models/conversation.js';
import {
  canTransition,
  normalizeConversationState,
  InvalidStateTransitionError,
} from '../models/conversation-state.js';
import type { Message } from '../models/message.js';
const HISTORY_LIMIT = 20;
const LEGACY_USER_ID = 'legacy';
function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (
      error as {
        code: unknown;
      }
    ).code === '23505'
  );
}
function toConversationMessage(
  row: typeof messages.$inferSelect,
): ConversationMessage {
  return {
    message_id: row.messageId,
    message: row.content,
    date: row.date.toISOString(),
    metadata: row.metadata ?? undefined,
    origin: row.origin,
    role: row.role,
  };
}
async function loadMessages(
  conversationId: string,
): Promise<ConversationMessage[]> {
  const rows = await getDatabase()
    .select()
    .from(messages)
    .where(eq(messages.conversationId, conversationId))
    .orderBy(asc(messages.date), asc(messages.messageId));
  return rows.map(toConversationMessage);
}
async function loadHistory(
  userId: string,
  limit: number,
): Promise<Conversation[]> {
  const rows = await getDatabase()
    .select()
    .from(conversations)
    .where(
      and(eq(conversations.userId, userId), eq(conversations.isActive, false)),
    )
    .orderBy(desc(conversations.updatedAt))
    .limit(limit);
  const history: Conversation[] = [];
  for (const row of rows) {
    history.push({
      id: row.id,
      state: normalizeConversationState(row.state),
      messages: await loadMessages(row.id),
      created_at: row.createdAt.toISOString(),
      updated_at: row.updatedAt.toISOString(),
    });
  }
  return history;
}
async function buildView(
  active: Conversation,
  userId: string,
  historyLimit = HISTORY_LIMIT,
): Promise<ConversationView> {
  const history = await loadHistory(userId, historyLimit);
  return {
    id: active.id,
    state: active.state,
    messages: active.messages,
    active_conversation: active,
    history,
  };
}
async function hydrate(
  row: typeof conversations.$inferSelect,
): Promise<Conversation> {
  return {
    id: row.id,
    state: normalizeConversationState(row.state),
    messages: await loadMessages(row.id),
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
  };
}
async function findActive(userId: string): Promise<Conversation | null> {
  const rows = await getDatabase()
    .select()
    .from(conversations)
    .where(
      and(eq(conversations.userId, userId), eq(conversations.isActive, true)),
    )
    .limit(1);
  if (rows.length === 0) return null;
  return hydrate(rows[0]);
}
export async function getOrCreateActiveConversation(
  userId: string,
): Promise<Conversation> {
  const existing = await findActive(userId);
  if (existing) return existing;
  const db = getDatabase();
  const id = randomUUID();
  const now = new Date();
  try {
    await db.insert(conversations).values({
      id,
      userId,
      state: 'idle',
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
    const winner = await findActive(userId);
    if (winner) return winner;
    throw error;
  }
  return {
    id,
    state: 'idle',
    messages: [],
    created_at: now.toISOString(),
    updated_at: now.toISOString(),
  };
}
export async function getHistoryIds(
  userId: string,
  limit = HISTORY_LIMIT,
): Promise<string[]> {
  const rows = await getDatabase()
    .select({ id: conversations.id })
    .from(conversations)
    .where(
      and(eq(conversations.userId, userId), eq(conversations.isActive, false)),
    )
    .orderBy(desc(conversations.updatedAt))
    .limit(limit);
  return rows.map((row) => row.id);
}
export async function getConversationView(
  userId: string,
  historyLimit = HISTORY_LIMIT,
): Promise<ConversationView> {
  const active = await getOrCreateActiveConversation(userId);
  return buildView(active, userId, historyLimit);
}
export async function setConversationState(
  userId: string,
  state: ConversationState,
): Promise<void> {
  await getDatabase()
    .update(conversations)
    .set({ state, updatedAt: new Date() })
    .where(
      and(eq(conversations.userId, userId), eq(conversations.isActive, true)),
    );
}
export async function transitionConversationState(
  userId: string,
  to: ConversationState,
): Promise<void> {
  const active = await getOrCreateActiveConversation(userId);
  if (!canTransition(active.state, to)) {
    throw new InvalidStateTransitionError(active.state, to);
  }
  await setConversationState(userId, to);
}
export async function appendMessage(
  message: Message,
  role: MessageRole,
  conversationId: string,
): Promise<ConversationMessage> {
  const db = getDatabase();
  const date = message.date ? new Date(message.date) : new Date();
  const row: typeof messages.$inferSelect = {
    conversationId,
    messageId: message.message_id,
    role,
    content: message.message,
    origin: message.origin,
    metadata: message.metadata ?? null,
    date,
  };
  await db.insert(messages).values(row).onConflictDoNothing();
  await db
    .update(conversations)
    .set({ updatedAt: new Date() })
    .where(eq(conversations.id, conversationId));
  return toConversationMessage(row);
}
export async function rotateConversation(
  userId: string,
): Promise<Conversation> {
  const db = getDatabase();
  const now = new Date();
  await db
    .update(conversations)
    .set({ isActive: false, state: 'idle', updatedAt: now })
    .where(
      and(eq(conversations.userId, userId), eq(conversations.isActive, true)),
    );
  const id = randomUUID();
  await db.insert(conversations).values({
    id,
    userId,
    state: 'idle',
    isActive: true,
    createdAt: now,
    updatedAt: now,
  });
  return {
    id,
    state: 'idle',
    messages: [],
    created_at: now.toISOString(),
    updated_at: now.toISOString(),
  };
}
export const legacyUserId = LEGACY_USER_ID;
