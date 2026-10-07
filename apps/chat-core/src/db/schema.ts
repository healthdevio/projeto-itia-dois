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
export const conversations = pgTable(
  'conversations',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    state: text('state').$type<ConversationState>().notNull().default('idle'),
    isActive: boolean('is_active').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex('conversations_user_single_active_idx')
      .on(table.userId, table.isActive)
      .where(sql`${table.isActive} = true`),
    index('conversations_user_updated_at_idx').on(
      table.userId,
      table.updatedAt,
    ),
  ],
);
export const messages = pgTable(
  'messages',
  {
    conversationId: text('conversation_id')
      .notNull()
      .references(() => conversations.id, { onDelete: 'cascade' }),
    messageId: text('message_id').notNull(),
    role: text('role').$type<MessageRole>().notNull(),
    content: text('content').notNull(),
    origin: text('origin').notNull(),
    metadata: text('metadata'),
    date: timestamp('date', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.conversationId, table.messageId] }),
    index('messages_conversation_date_idx').on(
      table.conversationId,
      table.date,
    ),
    check('messages_role_check', sql`${table.role} in ('user', 'assistant')`),
  ],
);
export const suggestions = pgTable(
  'suggestions',
  {
    conversationId: text('conversation_id')
      .notNull()
      .references(() => conversations.id, { onDelete: 'cascade' }),
    suggestionId: text('suggestion_id').notNull(),
    text: text('text').notNull(),
    position: integer('position').notNull(),
    date: timestamp('date', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.conversationId, table.suggestionId] }),
    index('suggestions_conversation_position_idx').on(
      table.conversationId,
      table.position,
    ),
  ],
);
export type ConversationRow = typeof conversations.$inferSelect;
export type MessageRow = typeof messages.$inferSelect;
export type SuggestionRow = typeof suggestions.$inferSelect;
