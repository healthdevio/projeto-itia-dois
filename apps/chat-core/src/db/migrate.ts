/**
 * Aplicação das migrations do Core.
 *
 * Usa o migrator do `drizzle-orm` (dependência de produção) para não precisar do
 * `drizzle-kit` na imagem. Roda num container `restart: no`, antes do Core.
 */

import { config } from 'dotenv';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';

import * as schema from './schema.js';

config();

const url = process.env.DATABASE_URL;

if (!url) {
  console.error(
    '[Core] DATABASE_URL não definida. Configure-a no ambiente (ver .env.example) antes de aplicar as migrations.',
  );
  process.exit(1);
}

const pool = new Pool({ connectionString: url, max: 1 });

try {
  await migrate(drizzle(pool, { schema }), {
    migrationsFolder: process.env.MIGRATIONS_FOLDER ?? './drizzle',
  });

  console.log('[Core] Migrations aplicadas.');
  await pool.end();
  process.exit(0);
} catch (error) {
  console.error(
    '[Core] Falha ao aplicar migrations:',
    error instanceof Error ? error.message : String(error),
  );

  // O Drizzle embrulha o erro do Postgres: `message` traz só o SQL que falhou,
  // e o motivo real ("relation does not exist", "duplicate key") vem em
  // `cause`. Sem esta linha o log mostra a query e nada sobre a causa.
  if (error instanceof Error && error.cause) {
    console.error(
      '[Core] Causa:',
      error.cause instanceof Error ? error.cause.message : String(error.cause),
    );
  }

  await pool.end();
  process.exit(1);
}
