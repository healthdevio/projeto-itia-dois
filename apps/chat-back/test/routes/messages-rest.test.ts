import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import { format } from 'node:util';

import type { INestApplication } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { ApiExceptionFilter } from '../../src/common/filters/api-exception.filter.js';
import { MessagesController } from '../../src/controllers/messages.controller.js';
import { IdentityGuard } from '../../src/middleware/identity.js';

import { DEFAULT_CHAT_CONFIG } from '../../src/models/chat-config.js';
import type { ChatRequest } from '../../src/models/chat-request.js';
import { AIError } from '../../src/services/ai/index.js';
import {
  MessageProcessingService,
  type MessageProcessingResult,
} from '../../src/services/message-processing/index.js';
import { authorizationHeaders } from '../helpers/identity.js';

interface RecordedCall {
  userId: string;
  request: ChatRequest;
  tenant?: string;
  signal?: AbortSignal;
}

let app: INestApplication;
let lastCall: RecordedCall | null = null;
let transitionedToErrorFor: string[] = [];
let erros: unknown[][] = [];
let avisos: unknown[][] = [];
const consoleErrorOriginal = console.error;
const consoleWarnOriginal = console.warn;
let nextHandler: (
  userId: string,
  req: ChatRequest,
  tenant?: string,
  signal?: AbortSignal,
) => Promise<MessageProcessingResult>;

const defaultResult = (req: ChatRequest): MessageProcessingResult => ({
  request_id: req.request_id,
  conversation_id: 'conv-rest-1',
  message_id: req.message_id,
  ai_response: 'Resposta via REST',
  state: 'success',
  suggestions: [{ suggestion_id: 'sg-1', text: 'Detalhar mais' }],
  config: DEFAULT_CHAT_CONFIG,
});

const processingStub = {
  async processMessage(
    userId: string,
    req: ChatRequest,
    tenant?: string,
    _onDelta?: (delta: string) => void,
    signal?: AbortSignal,
  ): Promise<MessageProcessingResult> {
    lastCall = { userId, request: req, tenant, signal };
    return nextHandler(userId, req, tenant, signal);
  },
  async transitionToError(userId: string): Promise<void> {
    transitionedToErrorFor.push(userId);
  },
};

before(async () => {
  console.error = (...args: unknown[]) => {
    erros.push(args);
  };
  console.warn = (...args: unknown[]) => {
    avisos.push(args);
  };

  const moduleRef = await Test.createTestingModule({
    controllers: [MessagesController],
    providers: [
      IdentityGuard,
      {
        provide: APP_FILTER,
        useClass: ApiExceptionFilter,
      },
      {
        provide: MessageProcessingService,
        useValue: processingStub,
      },
    ],
  }).compile();

  app = moduleRef.createNestApplication();
  await app.init();
});

after(async () => {
  await app.close();
  console.error = consoleErrorOriginal;
  console.warn = consoleWarnOriginal;
});

beforeEach(() => {
  lastCall = null;
  transitionedToErrorFor = [];
  erros = [];
  avisos = [];
  nextHandler = async (_userId, req) => defaultResult(req);
});

async function postRest(body: unknown, headers: Record<string, string> = {}) {
  const auth = await authorizationHeaders('ana');
  let req = request(app.getHttpServer())
    .post('/api/messages')
    .set('Content-Type', 'application/json');

  for (const [name, value] of Object.entries({ ...auth, ...headers })) {
    req = req.set(name, value);
  }

  return req.send(JSON.stringify(body));
}

const validPayload = {
  request_id: 'req-rest-1',
  message_id: 'msg-rest-1',
  message: 'Olá Omnia',
  origin: 'frontend',
};

void describe('POST /api/messages · fluxo REST completo', () => {
  void it('envia ChatRequest validado, devolve 200 ApiResponse<ChatResponse> e propaga X-Request-Id', async () => {
    const response = await postRest(validPayload);

    assert.equal(response.status, 200);
    assert.equal(response.headers['x-request-id'], 'req-rest-1');
    assert.deepEqual(response.body, {
      success: true,
      data: {
        request_id: 'req-rest-1',
        conversation_id: 'conv-rest-1',
        message_id: 'msg-rest-1',
        ai_response: 'Resposta via REST',
        state: 'success',
        suggestions: [{ suggestion_id: 'sg-1', text: 'Detalhar mais' }],
        config: DEFAULT_CHAT_CONFIG,
      },
    });

    assert.ok(lastCall);
    assert.equal(lastCall.userId, 'ana');
    assert.equal(lastCall.tenant, undefined);
    assert.equal(lastCall.request.request_id, 'req-rest-1');
    assert.ok(lastCall.signal instanceof AbortSignal);
    assert.deepEqual(transitionedToErrorFor, []);
  });

  void it('retorna 500 seguro e transita para error quando o ChatResponse viola o contrato', async () => {
    nextHandler = async (_userId, req) => ({
      ...defaultResult(req),
      conversation_id: '',
    });

    const response = await postRest(validPayload);

    assert.equal(response.status, 500);
    assert.equal(response.headers['x-request-id'], 'req-rest-1');
    assert.deepEqual(response.body, {
      success: false,
      error: 'Erro interno ao formatar resposta do chat',
    });
    assert.deepEqual(transitionedToErrorFor, ['ana']);
  });

  void it('não injeta linha nem formato no log de ChatResponse inválido (#23)', async () => {
    nextHandler = async (_userId, req) => ({
      ...defaultResult(req),
      conversation_id: '',
    });

    const ataque = 'req\n[Core] falso (request_id=%s)';
    const response = await postRest({ ...validPayload, request_id: ataque });

    assert.equal(response.status, 500);
    assert.equal(erros.length, 1);
    assert.equal(
      erros[0][0],
      '[Core] ChatResponse inválido gerado para %s (request_id=%s):',
    );

    const linha = format(...erros[0]);
    const prefixo = linha.slice(0, linha.indexOf(': ['));
    // O array `issues` é inspecionado com quebras pelo Node; a parte com dados
    // do cliente, porém, precisa ser uma única linha.
    assert.equal(
      prefixo,
      '[Core] ChatResponse inválido gerado para ana (request_id=req [Core] falso (request_id=%s))',
    );
    // eslint-disable-next-line no-control-regex -- verifica a ausência de quebras injetadas
    assert.doesNotMatch(prefixo, /[\r\n]/);
    assert.ok(linha.includes('%s'), '%s do cliente permanece como texto');
  });

  void it('mapeia AIError para 502 e transita conversa para error', async () => {
    nextHandler = async () => {
      throw new AIError('Provider de IA temporariamente indisponível');
    };

    const response = await postRest(validPayload);

    assert.equal(response.status, 502);
    assert.deepEqual(response.body, {
      success: false,
      error: 'Provider de IA temporariamente indisponível',
    });
    assert.deepEqual(transitionedToErrorFor, ['ana']);
  });

  void it('trata AbortError com 499 sem classificar como erro interno 500', async () => {
    nextHandler = async () => {
      const error = new Error('Operação cancelada pelo cliente');
      error.name = 'AbortError';
      throw error;
    };

    const response = await postRest(validPayload);

    assert.equal(response.status, 499);
    assert.deepEqual(response.body, {
      success: false,
      error: 'Requisição cancelada pelo cliente',
    });
    assert.deepEqual(transitionedToErrorFor, ['ana']);
  });

  void it('registra cancelamento sem quebra de linha nem formato controlado (#25)', async () => {
    nextHandler = async () => {
      const error = new Error('Operação cancelada pelo cliente');
      error.name = 'AbortError';
      throw error;
    };

    const ataque = 'req\r\n[Core] cancelado: %s';
    const response = await postRest({ ...validPayload, request_id: ataque });

    assert.equal(response.status, 499);
    assert.equal(avisos.length, 1);
    assert.equal(
      avisos[0][0],
      '[Core] Requisição REST cancelada pelo cliente para %s (request_id=%s)',
    );
    assert.equal(
      format(...avisos[0]),
      '[Core] Requisição REST cancelada pelo cliente para ana (request_id=req [Core] cancelado: %s)',
    );
    // eslint-disable-next-line no-control-regex -- verifica a ausência de quebras no registro
    assert.doesNotMatch(format(...avisos[0]), /[\r\n]/);
  });

  void it('oculta detalhes internos em erro inesperado e retorna 500 seguro', async () => {
    nextHandler = async () => {
      throw new Error('postgres://secret:password@db/omnia');
    };

    const response = await postRest(validPayload);

    assert.equal(response.status, 500);
    assert.deepEqual(response.body, {
      success: false,
      error: 'Erro interno ao processar mensagem',
    });
    assert.doesNotMatch(response.body.error, /postgres|password/);
    assert.deepEqual(transitionedToErrorFor, ['ana']);
  });
});
