import { Hono } from 'hono';
import { checkDatabase } from '../db/client.js';

const health = new Hono();

health.get('/health', async (c) => {
  const dbOk = await checkDatabase();
  return c.json({
    status: dbOk ? 'ok' : 'degraded',
    service: 'chat-ai-core',
    database: dbOk ? 'up' : 'down',
    timestamp: new Date().toISOString(),
  });
});

health.get('/health/ready', async (c) => {
  const dbOk = await checkDatabase();
  if (!dbOk)
    return c.json({ ready: false, reason: 'database_unavailable' }, 503);
  return c.json({ ready: true });
});

health.get('/health/live', (c) => c.json({ alive: true }));

export { health };
