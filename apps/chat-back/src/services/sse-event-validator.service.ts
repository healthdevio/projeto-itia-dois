import { Injectable } from '@nestjs/common';
import type { ContractValidationIssue } from '../models/contract-validation.js';
import {
  buildSafeSseErrorEvent,
  validateSseEvent,
  type SSEEvent,
  type SseErrorMetadata,
} from '../models/sse-events.js';
import { sanitizeForLog } from '../utils/sanitize-for-log.js';

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
      `[Core] Evento SSE inválido bloqueado: ${JSON.stringify({ requestId: sanitizeForLog(meta.request_id), issues: result.issues.map((issue) => ({ path: sanitizeForLog(issue.path), message: sanitizeForLog(issue.message) })) })}`,
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
      `[Core] Falha no fluxo SSE: ${JSON.stringify({ requestId: sanitizeForLog(meta.request_id), error: sanitizeForLog(error) })}`,
    );

    return {
      action: 'error',
      event: buildSafeSseErrorEvent(meta, safeMessage),
      reason: 'stream_interrupted',
    };
  }
}
