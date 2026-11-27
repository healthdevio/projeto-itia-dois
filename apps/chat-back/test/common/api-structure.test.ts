import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import {
  BadRequestException,
  NotFoundException,
  UnauthorizedException,
  type ArgumentsHost,
  type INestApplication,
} from '@nestjs/common';
import request from 'supertest';

import { ApiExceptionFilter } from '../../src/common/filters/api-exception.filter.js';
import { ZodValidationPipe } from '../../src/common/pipes/zod-validation.pipe.js';
import { ContractValidationError } from '../../src/models/contract-validation.js';
import { messageSchema } from '../../src/models/message.js';
import { createTestApp } from '../helpers/nest-app.js';

function createMockHost() {
  let statusCode = 0;
  let jsonBody: unknown;

  const response = {
    status(code: number) {
      statusCode = code;
      return this;
    },
    json(body: unknown) {
      jsonBody = body;
      return this;
    },
  };

  const host = {
    switchToHttp: () => ({
      getResponse: () => response,
    }),
  } as unknown as ArgumentsHost;

  return {
    host,
    getStatus: () => statusCode,
    getBody: () => jsonBody as Record<string, unknown>,
  };
}

void describe('ZodValidationPipe', () => {
  void it('valida e normaliza payloads compatíveis com o schema', () => {
    const pipe = new ZodValidationPipe(messageSchema, 'Message');

    const result = pipe.transform({
      message_id: '  msg-1  ',
      message: '  Olá  ',
      origin: '  web  ',
    });

    assert.equal(result.message_id, 'msg-1');
    assert.equal(result.message, 'Olá');
    assert.equal(result.origin, 'web');
  });

  void it('lança ContractValidationError com issues quando o payload é inválido', () => {
    const pipe = new ZodValidationPipe(messageSchema, 'Message');

    assert.throws(
      () => pipe.transform({ message_id: '', message: 'Olá', origin: 'web' }),
      (error: unknown) => {
        assert.ok(error instanceof ContractValidationError);
        assert.equal(error.contractName, 'Message');
        assert.ok(error.issues.some((issue) => issue.path === 'message_id'));
        return true;
      },
    );
  });
});

void describe('ApiExceptionFilter', () => {
  const filter = new ApiExceptionFilter();

  void it('converte ContractValidationError em 400 no formato ApiResponse', () => {
    const mock = createMockHost();
    const error = new ContractValidationError('ChatRequest', [
      {
        path: 'request_id',
        code: 'too_small',
        message: 'request_id é obrigatório',
      },
    ]);

    filter.catch(error, mock.host);

    assert.equal(mock.getStatus(), 400);
    assert.equal(mock.getBody().success, false);
    assert.match(String(mock.getBody().error), /Contrato ChatRequest inválido/);
  });

  void it('preserva status e mensagem de HttpException no formato ApiResponse', () => {
    const mock401 = createMockHost();
    filter.catch(
      new UnauthorizedException({
        success: false,
        error: 'Token de acesso inválido',
      }),
      mock401.host,
    );
    assert.equal(mock401.getStatus(), 401);
    assert.deepEqual(mock401.getBody(), {
      success: false,
      error: 'Token de acesso inválido',
    });

    const mock400 = createMockHost();
    filter.catch(
      new BadRequestException(['campo A inválido', 'campo B inválido']),
      mock400.host,
    );
    assert.equal(mock400.getStatus(), 400);
    assert.deepEqual(mock400.getBody(), {
      success: false,
      error: 'campo A inválido; campo B inválido',
    });

    const mock404 = createMockHost();
    filter.catch(new NotFoundException('Recurso não encontrado'), mock404.host);
    assert.equal(mock404.getStatus(), 404);
    assert.deepEqual(mock404.getBody(), {
      success: false,
      error: 'Recurso não encontrado',
    });
  });

  void it('oculta detalhes internos em erros inesperados e retorna 500 seguro', () => {
    const mock = createMockHost();

    filter.catch(
      new Error('postgres://usuario:senha_secreta@db/omnia'),
      mock.host,
    );

    assert.equal(mock.getStatus(), 500);
    assert.deepEqual(mock.getBody(), {
      success: false,
      error: 'Erro interno do servidor',
    });
  });
});

void describe('ApiExceptionFilter integrado ao AppModule', () => {
  let app: INestApplication;

  before(async () => {
    app = await createTestApp();
  });

  after(async () => {
    await app.close();
  });

  void it('padroniza 404 de rotas inexistentes no contrato ApiResponse', async () => {
    const response = await request(app.getHttpServer()).get(
      '/api/rota-inexistente',
    );

    assert.equal(response.status, 404);
    assert.equal(response.body.success, false);
    assert.equal(typeof response.body.error, 'string');
  });
});
