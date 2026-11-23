import { Inject, Injectable } from '@nestjs/common';
import type { RequestIdentity } from '../../middleware/identity.js';
import {
  HostIntegrationError,
  type HostConversationContext,
  type HostIntegration,
  type HostPrincipal,
} from '../../models/host-integration.js';
import type { HostContextLimits } from './host-context.config.js';
import { parseHostConversationContext } from './host-context.parser.js';
import {
  HOST_CONTEXT_LIMITS,
  HOST_CONTEXT_TIMEOUT_MS,
  HOST_INTEGRATION,
} from './host.tokens.js';

/**
 * Recebe o contexto do Host de forma controlada:
 *
 * 1. monta o principal a partir da identidade já verificada pelo Core;
 * 2. aplica um deadline e propaga cancelamento;
 * 3. valida, limita e reconstrói a resposta não confiável do Host;
 * 4. registra apenas metadados de auditoria, nunca o conteúdo.
 *
 * Não há cache: o contexto é carregado por conversa/turno e não é reutilizado
 * entre usuários.
 */
@Injectable()
export class HostContextService {
  constructor(
    @Inject(HOST_INTEGRATION) private readonly host: HostIntegration,
    @Inject(HOST_CONTEXT_LIMITS) private readonly limits: HostContextLimits,
    @Inject(HOST_CONTEXT_TIMEOUT_MS) private readonly timeoutMs: number,
  ) {}

  async load(
    identity: RequestIdentity,
    conversationId: string,
    signal?: AbortSignal,
  ): Promise<HostConversationContext> {
    const principal: HostPrincipal = {
      user_id: identity.userId,
      ...(identity.tenantId ? { tenant_id: identity.tenantId } : {}),
    };
    const started = Date.now();
    const deadline = AbortSignal.timeout(this.timeoutMs);
    const combined = signal ? AbortSignal.any([signal, deadline]) : deadline;

    try {
      const operation = this.host.loadConversationContext({
        principal,
        conversation_id: conversationId,
        signal: combined,
      });
      const raw = await withDeadline(
        operation,
        combined,
        this.timeoutMs,
        signal,
      );
      const context = parseHostConversationContext(raw, this.limits);

      console.log(
        `[Host] contexto · usuário ${identity.userId} · ` +
          `tenant ${identity.tenantId ?? 'default'} · ` +
          `conversa ${conversationId} · ` +
          `${context.tools.length} ferramentas · ` +
          `${context.chat_context.permissions?.length ?? 0} permissões · ` +
          `${Date.now() - started}ms`,
      );
      return context;
    } catch (error) {
      const failure =
        error instanceof HostIntegrationError
          ? error
          : new HostIntegrationError(
              'unknown',
              'Falha ao carregar o contexto do Host',
              { cause: error },
            );

      console.warn(
        `[Host] contexto recusado · usuário ${identity.userId} · ` +
          `tenant ${identity.tenantId ?? 'default'} · ` +
          `conversa ${conversationId} · ${failure.code} · ` +
          `${Date.now() - started}ms`,
      );
      throw failure;
    }
  }
}

/**
 * Impõe o deadline mesmo que o adaptador ignore o `AbortSignal`, e rejeita
 * cancelamento do chamador sem resolver com dados parciais.
 */
function withDeadline<T>(
  operation: Promise<T>,
  combined: AbortSignal,
  timeoutMs: number,
  caller?: AbortSignal,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    let settled = false;

    const finish = (apply: () => void): void => {
      if (settled) return;
      settled = true;
      combined.removeEventListener('abort', onAbort);
      apply();
    };
    const onAbort = (): void =>
      finish(() =>
        reject(
          caller?.aborted
            ? new HostIntegrationError(
                'unknown',
                'Carregamento do contexto do Host cancelado',
              )
            : new HostIntegrationError(
                'timeout',
                `Host não respondeu em ${timeoutMs}ms`,
              ),
        ),
      );

    combined.addEventListener('abort', onAbort, { once: true });
    operation.then(
      (value) => finish(() => resolve(value)),
      (error) => finish(() => reject(error)),
    );

    if (combined.aborted) onAbort();
  });
}
