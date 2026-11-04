import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';

import { AppModule } from '../../src/app.module.js';

/**
 * Sobe a aplicação Nest completa para os testes de rota.
 *
 * Os cenários cobertos aqui (identidade e validação) não dependem do Postgres:
 * quando a requisição chega ao banco, a falta de `DATABASE_URL` vira 500 e o
 * teste só verifica que a barreira anterior respondeu o esperado.
 */
export async function createTestApp(): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleRef.createNestApplication();
  await app.init();

  return app;
}
