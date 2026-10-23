import { config } from 'dotenv';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from '../../node_modules/@types/pg/index.js';
import * as schema from './schema.js';
config();
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
export function getPool(): Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: requireDatabaseUrl(),
      max: 10,
    });
    pool.on('error', (error) => {
      console.error('[DB] Erro em conexão ociosa:', error.message);
    });
  }
  return pool;
}
export function getDatabase(): ReturnType<typeof drizzle<typeof schema>> {
  if (!database) {
    database = drizzle(getPool(), { schema });
  }
  return database;
}
export async function checkDatabase(): Promise<boolean> {
  try {
    const result = await getPool().query('select 1');
    return result.rows.length === 1;
  } catch {
    return false;
  }
}
export async function closeDatabase(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
    database = null;
  }
}
