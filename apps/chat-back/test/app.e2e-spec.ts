import type { INestApplication } from '@nestjs/common';
import request from 'supertest';

import { createTestApp } from './helpers/nest-app.js';

describe('Core (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    app = await createTestApp();
  });

  it('/health/live (GET)', async () => {
    const response = await request(app.getHttpServer())
      .get('/health/live')
      .expect(200);

    expect(response.body).toEqual({ status: 'ok' });
  });

  afterEach(async () => {
    await app.close();
  });
});
