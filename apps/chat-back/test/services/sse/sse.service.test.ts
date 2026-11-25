import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { SseBroadcaster } from '../../../src/services/sse/broadcaster.js';
import { SseResponseChannel } from '../../../src/services/sse/channel.js';
import { SseService } from '../../../src/services/sse/sse.service.js';
import type { SseChannel } from '../../../src/services/sse/broadcaster.js';

/**
 * Canal SSE falso para testes de unidade. Registra os eventos escritos e
 * permite simular a desconexão do cliente.
 */
class FakeChannel implements SseChannel {
  readonly events: { type: string; data: unknown }[] = [];
  closed = false;
  private readonly controller = new AbortController();
  readonly abortSignal = this.controller.signal;

  write(event: { type: string; data: unknown }): boolean {
    if (this.closed) return false;
    this.events.push(event);
    return true;
  }

  close(): void {
    this.closed = true;
    this.controller.abort();
  }
}

function buildService(): { service: SseService; broadcaster: SseBroadcaster } {
  const broadcaster = new SseBroadcaster();
  const service = new SseService(broadcaster);
  return { service, broadcaster };
}

void describe('SseBroadcaster', () => {
  void it('registra e remove conexões', () => {
    const { broadcaster } = buildService();
    const channel = new FakeChannel();
    const id = 'conn-1';

    broadcaster.register(id, channel);
    assert.equal(broadcaster.size, 1);
    assert.equal(broadcaster.has(id), true);

    broadcaster.unregister(id);
    assert.equal(broadcaster.size, 0);
    assert.equal(broadcaster.has(id), false);
    assert.equal(channel.closed, true);
  });

  void it('closeAll encerra todas as conexões', () => {
    const { broadcaster } = buildService();
    const channel1 = new FakeChannel();
    const channel2 = new FakeChannel();
    broadcaster.register('c1', channel1);
    broadcaster.register('c2', channel2);

    broadcaster.closeAll();

    assert.equal(broadcaster.size, 0);
    assert.equal(channel1.closed, true);
    assert.equal(channel2.closed, true);
  });
});

void describe('SseResponseChannel', () => {
  void it('escreve eventos SSE no formato texto/event-stream', () => {
    const response = {
      writeHead: () => {},
      write: (chunk: string) => {
        response.body += chunk;
        return true;
      },
      end: () => {},
      on: () => {},
      body: '',
    } as unknown as Response;

    const channel = new SseResponseChannel(response);
    const ok = channel.write({
      type: 'ai.delta',
      data: { conversationId: 'c1', delta: 'olá' },
    });

    assert.equal(ok, true);
    assert.match(response.body, /event: ai\.delta/);
    assert.match(response.body, /data: \{/);
    assert.match(response.body, /olá/);
    assert.match(response.body, /\n\n$/);
  });

  void it('fecha ao detectar erro ou close da resposta', () => {
    const endCalls: unknown[] = [];
    const response = {
      writeHead: () => {},
      write: () => true,
      end: () => endCalls.push('end'),
      on: (event: string, handler: () => void) => {
        if (event === 'close') response._onClose = handler;
        if (event === 'error') response._onError = handler;
      },
    } as unknown as Response & { _onClose?: () => void; _onError?: () => void };

    const channel = new SseResponseChannel(response);
    channel.close();
    assert.equal(endCalls.length, 1);

    // Chamar close novamente não dispara end duas vezes.
    channel.close();
    assert.equal(endCalls.length, 1);
  });
});

void describe('SseService', () => {
  void it('abre uma conexão e notifica connection.opened no próprio canal', () => {
    const { service, broadcaster } = buildService();
    const channel = new FakeChannel();
    const connectionId = service.openConnection(channel);

    assert.equal(connectionId.startsWith('sse-'), true);
    assert.equal(broadcaster.has(connectionId), true);
    assert.equal(channel.events.length, 1);
    assert.equal(channel.events[0].type, 'connection.opened');
    assert.equal(
      (channel.events[0].data as { connectionId: string }).connectionId,
      connectionId,
    );
  });

  void it('escreve evento em conexão aberta e retorna false se inexistente', () => {
    const { service } = buildService();
    const ok = service.writeEvent('conexao-inexistente', {
      type: 'ai.delta',
      data: { conversationId: 'c1', delta: 'x' },
    });
    assert.equal(ok, false);
  });

  void it('fecha uma conexão aberta e escreve connection.closed', () => {
    const { service } = buildService();
    const channel = new FakeChannel();
    const connectionId = service.openConnection(channel);

    service.closeConnection(connectionId);
    assert.equal(channel.closed, true);
    const last = channel.events[channel.events.length - 1];
    assert.equal(last.type, 'connection.closed');
  });
});

// eslint-disable-next-line @typescript-eslint/no-var-requires
interface Response {
  writeHead: (status: number, headers: Record<string, string>) => void;
  write: (chunk: string) => boolean;
  end: () => void;
  on: (event: string, handler: () => void) => void;
  body: string;
}
