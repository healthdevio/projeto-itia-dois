import { Controller, Get, Res } from '@nestjs/common';
import type { Response } from 'express';
import { checkDatabase } from '../db/client.js';

@Controller('health')
export class HealthController {
  @Get()
  async status(@Res() response: Response): Promise<Response> {
    const databaseUp = await checkDatabase();
    return response.status(200).json({
      status: databaseUp ? 'ok' : 'degraded',
      service: 'chat-ai-core',
      database: databaseUp ? 'up' : 'down',
      timestamp: new Date().toISOString(),
    });
  }

  @Get('ready')
  async ready(@Res() response: Response): Promise<Response> {
    const databaseUp = await checkDatabase();
    return databaseUp
      ? response.status(200).json({ status: 'pass' })
      : response.status(503).json({ status: 'fail', reason: 'database_down' });
  }

  @Get('live')
  live(@Res() response: Response): Response {
    return response.status(200).json({ status: 'ok' });
  }
}
