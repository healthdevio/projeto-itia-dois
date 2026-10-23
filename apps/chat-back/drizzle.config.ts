import { config } from 'dotenv';
import { defineConfig } from 'drizzle-kit';

config();

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',

  // Mesmo schema que `src/db/migrate.ts` usa. Se este arquivo ficar no padrão
  // (`drizzle`), o `npm run db:migrate` de desenvolvimento grava os carimbos em
  // outro lugar do que o container de deploy — e o mesmo banco receberia duas
  // tabelas de controle, com as migrations pulando umas das outras.
  //
  // Ver a explicação completa em `src/db/migrate.ts`.
  migrations: {
    schema: 'drizzle_core',
    table: '__drizzle_migrations',
  },

  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
