import { randomUUID } from 'node:crypto';
import type { Response } from 'express';
import { SseEvent, SseChannel } from './broadcaster.js';
export class SseResponseChannel implements SseChannel {
  private readonly id: string;
  private readonly response: Response;
  private closed = false;
  private readonly controller = new AbortController();

  constructor(response: Response) {
    this.id = randomUUID();
    this.response = response;

    this.response.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });

    this.response.on('close', () => this.close());
    this.response.on('error', () => this.close());
  }

  get abortSignal(): AbortSignal {
    return this.controller.signal;
  }

  write(event: SseEvent): boolean {
    if (this.closed || this.controller.signal.aborted) return false;

    const chunks: string[] = [];
    if (event.id) chunks.push(`id: ${event.id}\n`);
    chunks.push(`event: ${event.type}\n`);
    const data = JSON.stringify(event.data);
    for (const line of data.split('\n')) {
      chunks.push(`data: ${line}\n`);
    }
    chunks.push('\n');

    try {
      this.response.write(chunks.join(''));
      return true;
    } catch {
      this.close();
      return false;
    }
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    try {
      this.response.end();
    } catch {
    }
    this.controller.abort();
  }
}
