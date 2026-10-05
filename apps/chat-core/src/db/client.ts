/**
 * Database Client — Core
 *
 * Conexão com o Postgres usada pelo Core para storear as conversas.
 *
 * A conexão é preguiçosa: o pool só é criado no primeiro uso, para que o
 * servidor suba e o health check responda mesmo com o banco indisponível.
 * Os endpoints que dependem do banco retornam 500 nesse caso.
 */

import { config } from 'dotenv';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

import * as schema from './schema.js';

config();

/**
 * Lê a `DATABASE_URL` do ambiente.
 *
 * @throws Error se a variável não estiver definida.
 */
function requireDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;

  if (!url) {
    throw new Error(
      'DATABASE_URL não definida. Configure-a no ambiente (ver .env.example) antes de usar os endpoints de conversa.',
    );
  }

  return url;
}

let pool: Pool | null = null;
let database: ReturnType<typeof drizzle<typeof schema>> | null = null;

/**
 * Retorna (criando se necessário) o pool de conexões.
 */
export function getPool(): Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: requireDatabaseUrl(),
      max: 10,
    });

    // Um erro em conexão ociosa não deve derrubar o processo: o `pg` emite
    // isso quando o Postgres reinicia. O pool se reconecta na próxima
    // consulta.
    pool.on('error', (error) => {
      console.error('[DB] Erro em conexão ociosa:', error.message);
    });
  }

  return pool;
}

/**
 * Retorna (criando se necessário) o cliente Drizzle.
 */
export function getDatabase(): ReturnType<typeof drizzle<typeof schema>> {
  if (!database) {
    database = drizzle(getPool(), { schema });
  }

  return database;
}

/**
 * Verifica se o banco está acessível.
 *
 * Usado pelo health check para reportar a dependência sem derrubar o server.
 */
export async function checkDatabase(): Promise<boolean> {
  try {
    const result = await getPool().query('select 1');
    return result.rows.length === 1;
  } catch {
    return false;
  }
}

/**
 * Encerra o pool. Usado no shutdown gracioso do servidor.
 */
export async function closeDatabase(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
    database = null;
  }
}
