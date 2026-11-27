import { Inject, Injectable } from '@nestjs/common';

import type { RequestIdentity } from '../../middleware/identity.js';
import {
  HostIntegrationError,
  type HostErrorCode,
  type HostIntegration,
  type HostToolOutput,
} from '../../models/host-integration.js';
import type { ToolCall } from '../../models/tool-call.js';
import {
  executeToolCall,
  type ToolExecutionResult,
  type ToolExecutor,
} from '../tools/tool-executor.js';
import type { HostExecutionLimits } from './host-execution.config.js';
import { toHostPrincipal, withDeadline } from './host-context.service.js';
import {
  HOST_EXECUTION_LIMITS,
  HOST_EXECUTION_TIMEOUT_MS,
  HOST_INTEGRATION,
} from './host.tokens.js';
import {
  HostToolCatalogService,
  type HostToolCatalogResult,
} from './host-tool-catalog.service.js';
import { parseHostToolOutput } from './host-tool-output.parser.js';

export interface HostToolExecutionCommand {
  /** Identidade verificada pelo Core, nunca lida do corpo, headers ou IA. */
  identity: RequestIdentity;
  /** Conversa verificada pelo Core, nunca a proposta pelo cliente/IA. */
  conversationId: string;
  toolCall: ToolCall;
  /**
   * Catálogo carregado para esta mesma identidade e conversa. Quando ausente,
   * o próprio serviço carrega o catálogo pela Task 03.
   */
  catalog?: HostToolCatalogResult;
  signal?: AbortSignal;
}

export type HostToolExecutionStage =
  | 'scope'
  | 'catalog'
  | 'authorization'
  | 'arguments'
  | 'duplicate'
  | 'host'
  | 'result';

export type HostToolExecutionFailure = {
  success: false;
  /** Categoria reutilizada do `executeToolCall` existente. */
  error: 'UNAUTHORIZED' | 'INVALID_ARGUMENTS' | 'EXECUTION_ERROR';
  /** Código do contrato `HostErrorCode`. */
  code: HostErrorCode;
  stage: HostToolExecutionStage;
  /** A operação pode ter sido aplicada mesmo assim; não reenviar automaticamente. */
  uncertain: boolean;
  /** `executeTool` foi chamado (diferente de carregar o catálogo). */
  host_called: boolean;
};

export type HostToolExecutionResult =
  | { success: true; output: HostToolOutput; host_called: true }
  | HostToolExecutionFailure;

type CatalogResolution =
  | { ok: true; catalog: HostToolCatalogResult }
  | { ok: false; failure: HostToolExecutionFailure };

function failure(
  error: HostToolExecutionFailure['error'],
  code: HostErrorCode,
  stage: HostToolExecutionStage,
  uncertain: boolean,
  hostCalled: boolean,
): HostToolExecutionFailure {
  return {
    success: false,
    error,
    code,
    stage,
    uncertain,
    host_called: hostCalled,
  };
}

function codeFromError(error: unknown): HostErrorCode {
  return error instanceof HostIntegrationError ? error.code : 'unknown';
}

/**
 * Pipeline de controle entre o provider de IA e o Host.
 *
 * O modelo propõe uma `ToolCall`, mas nunca autoriza nem executa nada: o Core
 * confere escopo, usa o catálogo filtrado da Task 03, delega autorização e
 * validação ao `executeToolCall` das Tasks 05–08 e só então chama o Host.
 */
@Injectable()
export class HostToolExecutionService {
  /** Chaves em voo neste processo/turno; não é idempotência distribuída. */
  private readonly inFlight = new Set<string>();

  constructor(
    @Inject(HOST_INTEGRATION) private readonly host: HostIntegration,
    @Inject(HostToolCatalogService)
    private readonly catalog: HostToolCatalogService,
    @Inject(HOST_EXECUTION_LIMITS)
    private readonly limits: HostExecutionLimits,
    @Inject(HOST_EXECUTION_TIMEOUT_MS) private readonly timeoutMs: number,
  ) {}

  async executeToolCall(
    command: HostToolExecutionCommand,
  ): Promise<HostToolExecutionResult> {
    const started = Date.now();
    let result: HostToolExecutionResult;

    try {
      result = await this.execute(command);
    } catch {
      result = failure('EXECUTION_ERROR', 'unknown', 'host', false, false);
    }

    this.audit(command, result, started);
    return result;
  }

  private async execute(
    command: HostToolExecutionCommand,
  ): Promise<HostToolExecutionResult> {
    const { identity, conversationId, toolCall, signal } = command;

    if (toolCall.context?.conversation_id !== conversationId) {
      return failure('UNAUTHORIZED', 'forbidden', 'scope', false, false);
    }

    const key = JSON.stringify([
      identity.userId,
      identity.tenantId ?? null,
      conversationId,
      toolCall.id,
    ]);
    if (this.inFlight.has(key)) {
      return failure('EXECUTION_ERROR', 'unknown', 'duplicate', true, false);
    }
    this.inFlight.add(key);

    try {
      const resolved = await this.resolveCatalog(command);
      if (!resolved.ok) return resolved.failure;

      const tool = Array.isArray(resolved.catalog.tools)
        ? resolved.catalog.tools.find(
            (candidate) => candidate.name === toolCall.tool_name,
          )
        : undefined;
      if (!tool) {
        return failure('UNAUTHORIZED', 'forbidden', 'catalog', false, false);
      }

      const deadline = AbortSignal.timeout(this.timeoutMs);
      const combined = signal ? AbortSignal.any([signal, deadline]) : deadline;
      let hostError: unknown;
      let hostCalled = false;

      const executor: ToolExecutor<HostToolOutput> = async () => {
        hostCalled = true;
        try {
          const pending = this.host.executeTool({
            principal: toHostPrincipal(identity),
            tool_call: toolCall,
            signal: combined,
          });
          return await withDeadline(pending, combined, this.timeoutMs, signal);
        } catch (error) {
          hostError = error;
          throw error;
        }
      };

      let execution: ToolExecutionResult<HostToolOutput>;
      try {
        execution = await executeToolCall(
          tool,
          toolCall,
          { permissions: resolved.catalog.chat_context.permissions },
          executor,
        );
      } catch {
        return failure(
          'EXECUTION_ERROR',
          'unknown',
          'authorization',
          false,
          hostCalled,
        );
      }

      if (!execution.success) {
        if (execution.error === 'UNAUTHORIZED') {
          return failure(
            'UNAUTHORIZED',
            'forbidden',
            execution.reason === 'tool_mismatch' ? 'catalog' : 'authorization',
            false,
            false,
          );
        }
        if (execution.error === 'INVALID_ARGUMENTS') {
          return failure(
            'INVALID_ARGUMENTS',
            'invalid_arguments',
            'arguments',
            false,
            false,
          );
        }

        const code = codeFromError(hostError);
        return failure(
          'EXECUTION_ERROR',
          code,
          'host',
          code === 'timeout' || Boolean(signal?.aborted),
          hostCalled,
        );
      }

      try {
        return {
          success: true,
          output: parseHostToolOutput(execution.output, this.limits),
          host_called: true,
        };
      } catch {
        return failure('EXECUTION_ERROR', 'unknown', 'result', false, true);
      }
    } finally {
      this.inFlight.delete(key);
    }
  }

  private async resolveCatalog(
    command: HostToolExecutionCommand,
  ): Promise<CatalogResolution> {
    if (!command.catalog) {
      try {
        return {
          ok: true,
          catalog: await this.catalog.getAvailableTools({
            identity: command.identity,
            conversationId: command.conversationId,
            signal: command.signal,
          }),
        };
      } catch (error) {
        return {
          ok: false,
          failure: failure(
            'EXECUTION_ERROR',
            codeFromError(error),
            'catalog',
            false,
            false,
          ),
        };
      }
    }

    const { catalog } = command;
    const matches =
      catalog.identity?.userId === command.identity.userId &&
      catalog.identity?.tenantId === command.identity.tenantId &&
      catalog.conversationId === command.conversationId;

    return matches
      ? { ok: true, catalog }
      : {
          ok: false,
          failure: failure(
            'UNAUTHORIZED',
            'forbidden',
            'catalog',
            false,
            false,
          ),
        };
  }

  /** Registro estruturado mínimo: sem argumentos, resultado completo ou segredos. */
  private audit(
    command: HostToolExecutionCommand,
    result: HostToolExecutionResult,
    started: number,
  ): void {
    const outcome = !result.success
      ? result.stage === 'result'
        ? 'invalid_result'
        : result.stage === 'host'
          ? [
              'unauthorized',
              'forbidden',
              'not_found',
              'invalid_arguments',
            ].includes(result.code)
            ? 'rejected'
            : 'error'
          : 'blocked'
      : 'success';

    console.log(
      JSON.stringify({
        event: 'host.tool_execution',
        at: new Date().toISOString(),
        user_id: command.identity.userId,
        tenant_id: command.identity.tenantId ?? null,
        tool: command.toolCall.tool_name,
        conversation_id: command.conversationId,
        tool_call_id: command.toolCall.id,
        duration_ms: Date.now() - started,
        outcome,
        code: result.success ? null : result.code,
      }),
    );
  }
}
