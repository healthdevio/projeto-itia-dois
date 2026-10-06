/**
 * Drizzle Schema — Core
 *
 * Tabelas que storeiam as conversas. A conversa é de posse exclusiva do Core:
 * a interface a lê, mas ninguém além do Core escreve.
 *
 * Tudo é escopado por `user_id`: cada usuário tem a sua própria conversa
 * ativa e o seu próprio histórico. A AI não tem acesso a estas tabelas —
 * o contexto chega até ela apenas via `src/services/ai/, que monta o
 * payload a partir do histórico lido aqui.
 */

import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

import type { ConversationState, MessageRole } from '../models/conversation.js';

/**
 * Conversas.
 *
 * `is_active` marca a conversa em andamento **do usuário**. O índice parcial
 * abaixo garante no banco que exista no máximo uma conversa ativa por usuário
 * — a unicidade é imposta pelo Postgres, não apenas pela aplicação.
 */
export const conversations = pgTable(
  'conversations',
  {
    id: text('id').primaryKey(),
    /**
     * Dono da conversa. Vem da identidade resolvida em
     * `src/middleware/identity.ts`; nunca do corpo da requisição.
     */
    userId: text('user_id').notNull(),
    state: text('state')
      .$type<ConversationState>()
      .notNull()
      .default('idle'),
    isActive: boolean('is_active').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    // Garante no máximo uma conversa ativa POR USUÁRIO. O par (user_id,
    // is_active) é único apenas entre as linhas com is_active = true, de modo
    // que cada usuário admite no máximo uma. Dois usuários distintos não
    // colidem, porque o user_id faz parte da chave.
    uniqueIndex('conversations_user_single_active_idx')
      .on(table.userId, table.isActive)
      .where(sql`${table.isActive} = true`),
    // Carrega o histórico de um usuário em ordem de recência.
    index('conversations_user_updated_at_idx').on(
      table.userId,
      table.updatedAt,
    ),
  ],
);

/**
 * Mensagens das conversas.
 *
 * A chave primária é composta por `(conversation_id, message_id)`: o
 * `message_id` é único **dentro** da conversa, não no banco inteiro. Sem
 * isso, dois usuários enviando `message_id: "msg-1"` colidiriam na primary key
 * e o segundo insert seria silenciosamente descartado.
 *
 * `role` distingue a mensagem do usuário da resposta da AI. Uma
 * constraint de CHECK mantém o domínio fechado caso a interface envie um
 * valor inesperado.
 */
export const messages = pgTable(
  'messages',
  {
    conversationId: text('conversation_id')
      .notNull()
      .references(() => conversations.id, { onDelete: 'cascade' }),
    /** Identificador da mensagem, único apenas dentro da conversa. */
    messageId: text('message_id').notNull(),
    role: text('role').$type<MessageRole>().notNull(),
    content: text('content').notNull(),
    origin: text('origin').notNull(),
    metadata: text('metadata'),
    date: timestamp('date', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.conversationId, table.messageId] }),
    // Carrega as mensagens de uma conversa em ordem cronológica.
    index('messages_conversation_date_idx').on(
      table.conversationId,
      table.date,
    ),
    // Mantém o domínio de `role` fechado no próprio banco.
    check('messages_role_check', sql`${table.role} in ('user', 'assistant')`),
  ],
);

/**
 * Sugestões da conversa.
 *
 * São as ações que a interface oferece abaixo da última resposta da AI.
 * Quem escreve é a AI (via `POST /api/messages`, que repassa o que ela
 * devolveu) e a própria interface (`POST /api/suggestions`); quem lê é a
 * interface, em `GET /api/suggestions`.
 *
 * O escopo vem da conversa, como nas mensagens: a tabela não tem `user_id`
 * porque não precisa — `conversation_id` só é alcançável a partir de uma
 * conversa já filtrada por usuário, e o `ON DELETE CASCADE` leva as sugestões
 * embora quando a conversa é rotacionada. A conversa nova começa vazia, que é
 * o comportamento desejado: as sugestões antigas eram daquela resposta.
 *
 * `position` preserva a ordem em que a AI sugeriu. A ordem faz parte do que
 * ela entendeu do contexto, então ela é gravada em vez de ser recalculada por
 * data — duas sugestões podem ter o mesmo timestamp.
 */
export const suggestions = pgTable(
  'suggestions',
  {
    conversationId: text('conversation_id')
      .notNull()
      .references(() => conversations.id, { onDelete: 'cascade' }),
    /** Identificador da sugestão, único apenas dentro da conversa. */
    suggestionId: text('suggestion_id').notNull(),
    /** Texto exibido na interface e enviado como mensagem ao clicar. */
    text: text('text').notNull(),
    /** Ordem sugerida pela AI. 0 é a primeira. */
    position: integer('position').notNull(),
    date: timestamp('date', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // A chave é composta como a de `messages`: o id é único DENTRO da
    // conversa, não no banco inteiro. Dois usuários podem receber a sugestão
    // "sg-1" sem colidir.
    primaryKey({ columns: [table.conversationId, table.suggestionId] }),
    // Carrega as sugestões de uma conversa na ordem em que foram sugeridas.
    index('suggestions_conversation_position_idx').on(
      table.conversationId,
      table.position,
    ),
  ],
);

export type ConversationRow = typeof conversations.$inferSelect;
export type MessageRow = typeof messages.$inferSelect;
export type SuggestionRow = typeof suggestions.$inferSelect;
