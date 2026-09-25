import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  integer,
} from 'drizzle-orm/pg-core';

export const knowledgeBases = pgTable('knowledge_bases', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  createdAt: timestamp('created_at', {
    withTimezone: true,
  })
    .defaultNow()
    .notNull(),

  updateAt: timestamp('update_at', {
    withTimezone: true,
  })
    .defaultNow()
    .notNull(),
});

export const knowledgeDocuments = pgTable('knowledge_documents', {
  id: uuid('id').defaultRandom().primaryKey(),

  knowledgeBaseId: uuid('knowledge_base_id')
    .notNull()
    .references(() => knowledgeBases.id, {
      onDelete: 'cascade',
    }),

  title: text('title').notNull(),

  source: text('source'),

  content: text('content').notNull(),

  metadata: jsonb('metadata'),

  createAt: timestamp('creat_at', {
    withTimezone: true,
  })
    .defaultNow()
    .notNull(),
});

export const knowledgeChunks = pgTable('knowledge_chunks', {
  id: uuid('id').defaultRandom().primaryKey(),

  documentId: uuid('document_id')
    .notNull()
    .references(() => knowledgeDocuments.id, {
      onDelete: 'cascade',
    }),

  content: text('content').notNull(),

  chunkIndex: integer('chunk_index').notNull(),

  metadata: jsonb('metadata'),

  createdAt: timestamp('created_at', {
    withTimezone: true,
  })
    .defaultNow()
    .notNull(),
});
