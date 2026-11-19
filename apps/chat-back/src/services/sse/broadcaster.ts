import { EventEmitter } from 'node:events';

export type SseConnectionId = string;

export interface SseEvent {
  type: string;
  data: unknown;
  id?: string;
}
export interface SseChannel {
  write(event: SseEvent): boolean;
  close(): void;
  readonly abortSignal: AbortSignal;
}

export class SseBroadcaster extends EventEmitter {
  private readonly connections = new Map<SseConnectionId, SseChannel>();

  register(id: SseConnectionId, channel: SseChannel): void {
    this.connections.set(id, channel);
    this.emit('connection', id, channel);
  }

  unregister(id: SseConnectionId): void {
    const channel = this.connections.get(id);
    if (channel) {
      channel.close();
      this.connections.delete(id);
      this.emit('disconnection', id);
    }
  }

  get size(): number {
    return this.connections.size;
  }

  has(id: SseConnectionId): boolean {
    return this.connections.has(id);
  }

  get(id: SseConnectionId): SseChannel | undefined {
    return this.connections.get(id);
  }

  closeAll(): void {
    for (const [id, channel] of this.connections) {
      channel.close();
      this.connections.delete(id);
      this.emit('disconnection', id);
    }
  }
}
