/**
 * Chat Mia Core - Servidor Principal
 *
 * Este é o servidor principal do Core do Chat Mia.
 *
 * Responsabilidades:
 * - Receber mensagens da interface e repassá-las para a Mia AI
 *   (`POST /api/messages`).
 * - Entregar a conversa atual para a interface
 *   (`GET /api/conversations/current`).
 * - Guardar a conversa internamente, no Postgres. A conversa nunca é
 *   enviada para a Mia AI.
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { serve } from '@hono/node-server';

import { checkDatabase, closeDatabase } from './db/client.js';
import { conversationRoutes } from './routes/conversations.js';
import { messageRoutes } from './routes/messages.js';

const app = new Hono();

// Middleware
app.use('*', cors());
app.use('*', logger());

/**
 * Rota de health check
 *
 * Reporta também o estado do Postgres, que é a dependência dos endpoints de
 * conversa. Um banco fora do ar não derruba o servidor: o health check
 * apenas reporta `database: "down"`.
 */
app.get('/', async (c) => {
  const databaseUp = await checkDatabase();

  return c.json({
    status: databaseUp ? 'ok' : 'degraded',
    service: 'chat-mia-core',
    database: databaseUp ? 'up' : 'down',
  });
});

/**
 * Mensagens da interface para a Mia AI.
 */
app.route('/api/messages', messageRoutes);

/**
 * Conversa atual para a interface.
 */
app.route('/api/conversations', conversationRoutes);

/**
 * Inicia o servidor
 */
const port = parseInt(process.env.CORE_PORT || '3001');

console.log(`[Core] Iniciando servidor na porta ${port}...`);

const server = serve({
  fetch: app.fetch,
  port,
});

console.log(`[Core] Servidor rodando em http://localhost:${port}`);

/**
 * Encerra o servidor e fecha o pool de conexões.
 */
async function shutdown(signal: string) {
  console.log(`[Core] Recebido ${signal}, encerrando...`);
  await closeDatabase();
  server.close(() => process.exit(0));
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));

export default app;
