import 'dotenv/config';
import { eq } from 'drizzle-orm';
import { closeDb, db } from '../src/db/index.js';
import { knowledgeDocuments, knowledgeChunks } from '../src/db/schema.js';
import { generateEmbedding } from './nvidia-embeddings.js';

async function main() {
  let insertedChunkId: string | undefined;

  try {
    const documentId = process.env.TEST_DOCUMENT_ID;

    if (!documentId) {
      throw new Error(
        'Configure TEST_DOCUMENT_ID com o ID de um documento de teste.',
      );
    }

    console.log('Buscando documento...');

    const [document] = await db
      .select()
      .from(knowledgeDocuments)
      .where(eq(knowledgeDocuments.id, documentId));

    if (!document) {
      throw new Error('Documento de teste não encontrado.');
    }

    console.log('Documento encontrado!');
    console.log(`Título: ${document.title}`);

    console.log('Gerando embedding...');

    const embedding = await generateEmbedding(document.content, 'passage');

    console.log(`Embedding gerado: ${embedding.length} dimensões`);
    console.log('Salvando no PostgreSQL...');

    const [chunk] = await db
      .insert(knowledgeChunks)
      .values({
        documentId: document.id,
        content: document.content,
        chunkIndex: 0,
        metadata: {
          test: true,
        },
        embedding,
      })
      .returning();

    if (!chunk) {
      throw new Error('Não foi possível recuperar o chunk inserido.');
    }

    insertedChunkId = chunk.id;

    console.log('Embedding salvo com sucesso!');
    console.log(`Chunk ID: ${chunk.id}`);
    console.log(`Dimensões armazenadas: ${chunk.embedding?.length}`);
  } catch (error) {
    console.error(
      'Erro no teste:',
      error instanceof Error ? error.message : error,
    );
    process.exitCode = 1;
  } finally {
    try {
      if (insertedChunkId) {
        await db
          .delete(knowledgeChunks)
          .where(eq(knowledgeChunks.id, insertedChunkId));

        console.log('Registro de teste removido.');
      }
    } finally {
      await closeDb();
    }
  }
}

main();
