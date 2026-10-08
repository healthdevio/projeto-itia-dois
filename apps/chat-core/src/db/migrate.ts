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

/**
 * Schema onde fica a tabela de controle das migrations do Core.
 *
 * ## Por que não `drizzle`
 *
 * É o padrão do Drizzle, e é o mesmo para todo mundo que aponta para o mesmo
 * banco. O pacote `knowledge` roda as migrations dele em `drizzle`, e o Core
 * precisa das suas no mesmo banco — os dois concorrem pela mesma tabela.
 *
 * O migrator decide o que já foi aplicado comparando o timestamp de cada
 * migration com o último carimbo registrado. Os journals são:
 *
 * ```
 * knowledge  0000 a 0006   2026-09-25 a 2026-09-30
 * chat-core  0000          2026-09-28   ← mais antiga que o carimbo do knowledge
 *            0001 a 0003   2026-10-01 a 2026-10-06
 * ```
 *
 * Com a tabela compartilhada, o Core lia o carimbo `2026-09-30` do `knowledge`,
 * concluía que a própria `0000` já tinha sido aplicada, e a pulava. A `0001`
 * rodava em cima de um banco sem a tabela `conversations`, e o
 * `ALTER TABLE suggestions ADD CONSTRAINT ... REFERENCES conversations(id)`
 * falhava — com a falha parecendo ser da migration errada.
 *
 * Separar o schema elimina a competição: o Core só enxerga os próprios
 * carimbos. O `knowledge` continua usando `drizzle`, sem ser tocado.
 */
const MIGRATIONS_SCHEMA = 'drizzle_core';

try {
  await migrate(drizzle(pool, { schema }), {
    migrationsFolder: process.env.MIGRATIONS_FOLDER ?? './drizzle',
    migrationsSchema: MIGRATIONS_SCHEMA,
  });

  console.log(`[Core] Migrations aplicadas (schema ${MIGRATIONS_SCHEMA}).`);
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
