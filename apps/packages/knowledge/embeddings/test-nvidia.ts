import 'dotenv/config';
import { generateEmbedding } from './nvidia-embeddings.js';

async function main() {
  console.log('Testando geração de embedding...');

  const embedding = await generateEmbedding(
    'Este é um texto de teste para o Omnia.',
    'passage',
  );

  console.log('Embedding gerado com sucesso!');
  console.log(`Dimensões: ${embedding.length}`);
  console.log(`Primeiros valores: ${embedding.slice(0, 5).join(', ')}`);
}

main().catch((error) => {
  console.error('Erro ao gerar embedding:', error.message);
  process.exit(1);
});
