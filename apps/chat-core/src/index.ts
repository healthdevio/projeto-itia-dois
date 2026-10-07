import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { serve } from '@hono/node-server';
import { checkDatabase, closeDatabase } from './db/client.js';
import { conversationRoutes } from './routes/conversations.js';
import { messageRoutes } from './routes/messages.js';
import { suggestionRoutes } from './routes/suggestions.js';
import { getProvider } from './services/ai/index.js';
const app = new Hono();
app.use('*', cors());
app.use('*', logger());
app.get('/', async (c) => {
  const databaseUp = await checkDatabase();
  return c.json({
    status: databaseUp ? 'ok' : 'degraded',
    service: 'chat-ai-core',
    database: databaseUp ? 'up' : 'down',
  });
});
app.route('/api/messages', messageRoutes);
app.route('/api/conversations', conversationRoutes);
app.route('/api/suggestions', suggestionRoutes);
const port = parseInt(process.env.CORE_PORT || '3001');
console.log(`[Core] Iniciando servidor na porta ${port}...`);
try {
  const provider = await getProvider();
  console.log(`[Core] AI: provider ${provider.name} · ${provider.describe()}`);
} catch (error) {
  console.warn(
    `[Core] ATENÇÃO: ${error instanceof Error ? error.message : String(error)}`,
  );
}
const server = serve({
  fetch: app.fetch,
  port,
});
console.log(`[Core] Servidor rodando em http://localhost:${port}`);
async function shutdown(signal: string) {
  console.log(`[Core] Recebido ${signal}, encerrando...`);
  await closeDatabase();
  server.close(() => process.exit(0));
}
process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
export default app;
