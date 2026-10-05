/**
 * Conversation Repository
 *
 * Único ponto de acesso do Core às conversas persistidas.
 *
 * **Todo método exige um `userId`.** Não existe operação sem escopo de
 * usuário: é isso que impede uma consulta de devolver a conversa de outra
 * pessoa. A identidade vem de `src/middleware/identity.ts` e nunca do corpo
 * da requisição.
 *
 * A conversa nunca é enviada para a AI — ela é estado interno do Core.
 * O repositório existe para isolar o resto do código do Drizzle, de modo que
 * trocar a camada de persistência não afete as rotas nem os serviços.
 */

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
import type { Message } from '../models/message.js';

/** Quantas conversas anteriores o `history` carrega por padrão. */
const HISTORY_LIMIT = 20;

/** `user_id` atribuído às conversas criadas antes do multi-usuário. */
const LEGACY_USER_ID = 'legacy';

/**
 * Verifica se o erro é uma violação de constraint única do Postgres (23505).
 *
 * Usado para tratar a corrida de criação da conversa ativa sem mascarar
 * outros erros de banco.
 */
function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code: unknown }).code === '23505'
  );
}

/**
 * Converte uma linha do banco em `ConversationMessage`.
 */
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

/**
 * Carrega as mensagens de uma conversa em ordem cronológica.
 *
 * As mensagens herdam o escopo do usuário por cascade: só são alcançáveis
 * através de uma conversa já filtrada por `userId`.
 */
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

/**
 * Carrega as conversas anteriores **de um usuário**, mais recente primeiro.
 */
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
      state: row.state,
      messages: await loadMessages(row.id),
      created_at: row.createdAt.toISOString(),
      updated_at: row.updatedAt.toISOString(),
    });
  }

  return history;
}

/**
 * Monta a `ConversationView` devolvida para a interface.
 */
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

/**
 * Carrega uma conversa a partir de uma linha do banco.
 */
async function hydrate(
  row: typeof conversations.$inferSelect,
): Promise<Conversation> {
  return {
    id: row.id,
    state: row.state,
    messages: await loadMessages(row.id),
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
  };
}

/**
 * Lê a conversa ativa de um usuário.
 */
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

/**
 * Retorna a conversa ativa de um usuário, criando-a se ainda não existir.
 *
 * A interface sempre recebe uma conversa válida ao abrir o chat, sem precisar
 * de um passo de "criar" separado.
 *
 * A criação é sempre escopada: cada usuário ganha a sua própria conversa, e
 * dois usuários distintos nunca colidem porque `user_id` faz parte da chave do
 * índice único.
 */
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
      state: 'greeting',
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;

    // Perdemos a corrida para outra requisição do MESMO usuário: a conversa
    // que ela criou é a conversa ativa. Requisições de outros usuários não
    // chegam aqui, pois não colidem no índice.
    const winner = await findActive(userId);
    if (winner) return winner;

    throw error;
  }

  return {
    id,
    state: 'greeting',
    messages: [],
    created_at: now.toISOString(),
    updated_at: now.toISOString(),
  };
}

/**
 * Ids das conversas anteriores de um usuário, mais recente primeiro.
 *
 * Usado para montar o `history_ids` do contexto da AI. Os ids, e não as
 * conversas inteiras: a IA recebe a referência de que houve diálogos
 * anteriores, sem o conteúdo deles.
 */
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

/**
 * Monta a visão completa da conversa atual de um usuário.
 */
export async function getConversationView(
  userId: string,
  historyLimit = HISTORY_LIMIT,
): Promise<ConversationView> {
  const active = await getOrCreateActiveConversation(userId);
  return buildView(active, userId, historyLimit);
}

/**
 * Atualiza o estado da conversa ativa de um usuário.
 *
 * Sem `userId` isto mudaria a conversa de todo mundo; o escopo é obrigatório.
 */
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

/**
 * Adiciona uma mensagem a uma conversa e atualiza `updated_at`.
 *
 * `conversationId` deve vir sempre de uma consulta escopada por `userId`
 * (`getOrCreateActiveConversation`), nunca do corpo da requisição.
 *
 * Inserir a mesma mensagem duas vezes é um no-op: a chave primária é
 * `(conversation_id, message_id)`, o que torna o envio idempotente dentro da
 * conversa.
 */
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

/**
 * Encerra a conversa ativa de um usuário e inicia outra.
 *
 * A conversa encerrada permanece no banco e passa a integrar o `history`
 * **dele**. Rotacionar não afeta nenhum outro usuário.
 */
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
    state: 'greeting',
    isActive: true,
    createdAt: now,
    updatedAt: now,
  });

  return {
    id,
    state: 'greeting',
    messages: [],
    created_at: now.toISOString(),
    updated_at: now.toISOString(),
  };
}

/** Dono das conversas criadas antes do multi-usuário existir. */
export const legacyUserId = LEGACY_USER_ID;
