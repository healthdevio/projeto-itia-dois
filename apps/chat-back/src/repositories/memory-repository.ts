import { and, desc, eq, ilike, or } from 'drizzle-orm';
import { getDatabase } from '../db/client.js';
import { memories } from '../db/schema.js';
import type { MemoryRow } from '../db/schema.js';
import { randomUUID } from 'node:crypto';

export interface Memory {
  id: string;
  userId: string;
  content: string;
  category: string;
  importance: number;
  context: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateMemoryInput {
  userId: string;
  content: string;
  category?: string;
  importance?: number;
  context?: string;
}

export interface UpdateMemoryInput {
  content?: string;
  category?: string;
  importance?: number;
  context?: string;
}

export interface RelevantMemory {
  id: string;
  content: string;
  category: string;
  importance: number;
  context: string | null;
  updatedAt: string;
}

function toMemory(row: MemoryRow): Memory {
  return {
    id: row.id,
    userId: row.userId,
    content: row.content,
    category: row.category,
    importance: row.importance,
    context: row.context ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toRelevantMemory(row: MemoryRow): RelevantMemory {
  return {
    id: row.id,
    content: row.content,
    category: row.category,
    importance: row.importance,
    context: row.context ?? null,
    updatedAt: row.updatedAt.toISOString(),
  };
}


function palavrasSignificativas(texto: string): string[] {
  return texto
    .toLowerCase()
    .replace(/[^\w\sáàâãéêíóôõúç]/gi, ' ')
    .split(/\s+/)
    .filter((palavra) => palavra.length > 2);
}

type DB = ReturnType<typeof getDatabase>;


export async function createMemory(
  input: CreateMemoryInput,
  db: DB = getDatabase(),
): Promise<Memory> {
  const id = randomUUID();
  const now = new Date();
  const [row] = await db
    .insert(memories)
    .values({
      id,
      userId: input.userId,
      content: input.content,
      category: input.category ?? 'geral',
      importance: input.importance ?? 1,
      context: input.context ?? null,
      createdAt: now,
      updatedAt: now,
    })
    .returning();
  return toMemory(row);
}


export async function listMemories(
  userId: string,
  db: DB = getDatabase(),
): Promise<Memory[]> {
  const rows = await db
    .select()
    .from(memories)
    .where(eq(memories.userId, userId))
    .orderBy(desc(memories.updatedAt), desc(memories.createdAt))
    .limit(50);
  return rows.map(toMemory);
}


export async function getMemory(
  id: string,
  userId: string,
  db: DB = getDatabase(),
): Promise<Memory | null> {
  const rows = await db
    .select()
    .from(memories)
    .where(and(eq(memories.id, id), eq(memories.userId, userId)))
    .limit(1);
  if (rows.length === 0) return null;
  return toMemory(rows[0]);
}


export async function updateMemory(
  id: string,
  userId: string,
  updates: UpdateMemoryInput,
  db: DB = getDatabase(),
): Promise<Memory | null> {
  const campos: Record<string, unknown> = {};
  if (updates.content !== undefined) campos.content = updates.content;
  if (updates.category !== undefined) campos.category = updates.category;
  if (updates.importance !== undefined) campos.importance = updates.importance;
  if (updates.context !== undefined) campos.context = updates.context;
  if (Object.keys(campos).length === 0) {
    return getMemory(id, userId, db);
  }
  campos.updatedAt = new Date();
  const [row] = await db
    .update(memories)
    .set(campos)
    .where(and(eq(memories.id, id), eq(memories.userId, userId)))
    .returning();
  if (!row) return null;
  return toMemory(row);
}


export async function deleteMemory(
  id: string,
  userId: string,
  db: DB = getDatabase(),
): Promise<boolean> {
  const result = await db
    .delete(memories)
    .where(and(eq(memories.id, id), eq(memories.userId, userId)));
  return (result.rowCount ?? 0) > 0;
}


export async function buscarMemoriasSimilares(
  userId: string,
  conteudo: string,
  limite = 10,
  db: DB = getDatabase(),
): Promise<Memory[]> {
  const palavras = palavrasSignificativas(conteudo);
  if (palavras.length === 0)
    return (await listMemories(userId, db)).slice(0, limite);

  const condicoes = palavras.map((palavra) =>
    ilike(memories.content, `%${palavra}%`),
  );
  const rows = await db
    .select()
    .from(memories)
    .where(and(eq(memories.userId, userId), or(...condicoes)))
    .orderBy(desc(memories.importance), desc(memories.updatedAt))
    .limit(limite);
  return rows.map(toMemory);
}


export async function listarMemoriasRecentes(
  userId: string,
  limite: number,
  db: DB = getDatabase(),
): Promise<Memory[]> {
  const todas = await listMemories(userId, db);
  return todas.slice(0, limite);
}


export async function findRelevantMemories(
  userId: string,
  mensagem: string,
  limite = 5,
  db: DB = getDatabase(),
): Promise<RelevantMemory[]> {
  const palavras = palavrasSignificativas(mensagem);
  const rows = await db
    .select()
    .from(memories)
    .where(eq(memories.userId, userId))
    .orderBy(desc(memories.importance), desc(memories.updatedAt))
    .limit(limite);

  if (palavras.length === 0) return [];

  const pontuadas = rows.map((row) => {
    const conteudo = row.content.toLowerCase();
    let pontos = 0;
    for (const palavra of palavras) {
      if (conteudo.includes(palavra)) pontos += 1;
    }
    return { row, pontos };
  });

  const relevantes = pontuadas
    .filter(({ pontos }) => pontos > 0)
    .sort((a, b) => b.pontos - a.pontos || b.row.importance - a.row.importance)
    .slice(0, limite)
    .map(({ row }) => toRelevantMemory(row));

  return relevantes;
}

export { palavrasSignificativas };
