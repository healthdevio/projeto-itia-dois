import { sql } from 'drizzle-orm';
import { closeDb, db } from './index.js';

async function main() {
  try {
    const result = await db.execute(sql`SELECT 1 AS ok`);

    console.log('Conexão com PostgreSQL funcionando!');
    console.log(result.rows);
  } catch (error) {
    console.error(
      'Erro na conexão:',
      error instanceof Error ? error.message : error,
    );
    process.exitCode = 1;
  } finally {
    await closeDb();
  }
}

main();
