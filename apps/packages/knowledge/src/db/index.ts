import 'dotenv/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Client } from 'pg';

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error('A variável DATABASE_URL não está configurada.');
}

const client = new Client({
  connectionString: databaseUrl,
});

await client.connect();

export const db = drizzle(client);

export async function closeDb(): Promise<void> {
  await client.end();
}
