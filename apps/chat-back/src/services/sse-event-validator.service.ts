import { Injectable } from '@nestjs/common';
import type { ContractValidationIssue } from '../models/contract-validation.js';
import {
  buildSafeSseErrorEvent,
  validateSseEvent,
  type SSEEvent,
  type SseErrorMetadata,
} from '../models/sse-events.js';

export type StreamEventDecision =
  | { action: 'emit'; event: SSEEvent }
  | {
      action: 'error';
      event: SSEEvent;
      reason: string;
      issues?: ContractValidationIssue[];
    };

@Injectable()
export class SseEventValidatorService {
  validateOutgoing(
    candidate: unknown,
    meta: SseErrorMetadata,
  ): StreamEventDecision {
    const result = validateSseEvent(candidate);
    if (result.ok) {
      return { action: 'emit', event: result.data };
    }

    console.error(
      `[Core] Evento SSE inválido bloqueado (request_id=${meta.request_id}):`,
      result.issues,
    );

    return {
      action: 'error',
      event: buildSafeSseErrorEvent(meta),
      reason: 'invalid_sse_event',
      issues: result.issues,
    };
  }

  handleStreamFailure(
    error: unknown,
    meta: SseErrorMetadata,
    safeMessage = 'Falha durante o streaming da resposta',
  ): StreamEventDecision {
    console.error(
      `[Core] Falha no fluxo SSE (request_id=${meta.request_id}):`,
      error,
    );

    return {
      action: 'error',
      event: buildSafeSseErrorEvent(meta, safeMessage),
      reason: 'stream_interrupted',
    };
  }
}
