/**
 * Chat Mia Core - Servidor Principal
 * 
 * Este é o servidor principal do Core do Chat Mia.
 * Responsável por receber mensagens da interface e processá-las.
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { serve } from '@hono/node-server';

import type { Message, ApiResponse } from './models/message.js';
import { sendToMiaAI } from './services/mia-ai.js';

const app = new Hono();

// Middleware
app.use('*', cors());
app.use('*', logger());

/**
 * Rota de health check
 */
app.get('/', (c) => {
  return c.json({ status: 'ok', service: 'chat-mia-core' });
});

/**
 * Endpoint para receber mensagens da interface
 * 
 * POST /api/messages
 * 
 * Recebe uma mensagem do frontend, valida e processa.
 * Retorna código HTTP baseado no resultado:
 * - 200: Sucesso
 * - 400: JSON inválido ou campos obrigatórios faltando
 * - 500: Erro interno
 */
app.post('/api/messages', async (c) => {
  try {
    const body = await c.req.json<Message>();

    // Validação dos campos obrigatórios
    if (!body.message_id || !body.message || !body.origin) {
      const response: ApiResponse = {
        success: false,
        error: 'Campos obrigatórios faltando: message_id, message, origin'
      };
      return c.json(response, 400);
    }

    // Adiciona data se não fornecida
    const message: Message = {
      ...body,
      date: body.date || new Date().toISOString()
    };

    console.log(`[Core] Mensagem recebida de ${message.origin}:`, message.message_id);

    // TODO: Processar a mensagem conforme necessário
    // Exemplo: validações adicionais, transformações, etc.

    // Envia para a Mia AI (integração futura)
    const miaResponse = await sendToMiaAI(message);

    const response: ApiResponse = {
      success: true,
      data: {
        message_id: message.message_id,
        mia_ai_response: miaResponse.response
      }
    };

    return c.json(response, 200);

  } catch (error) {
    console.error('[Core] Erro ao processar mensagem:', error);
    
    const response: ApiResponse = {
      success: false,
      error: 'Erro interno ao processar mensagem'
    };
    
    return c.json(response, 500);
  }
});

/**
 * Inicia o servidor
 */
const port = parseInt(process.env.CORE_PORT || '3001');

console.log(`[Core] Iniciando servidor na porta ${port}...`);

serve({
  fetch: app.fetch,
  port,
});

console.log(`[Core] Servidor rodando em http://localhost:${port}`);
