import type { ChatContext } from '../../src/models/chat-context.js';
import type { Tool } from '../../src/models/tool.js';
import type { ToolCall } from '../../src/models/tool-call.js';
import {
  HostIntegrationError,
  type HostContextRequest,
  type HostConversationContext,
  type HostIntegration,
  type HostToolExecutionRequest,
  type HostToolOutput,
} from '../../src/models/host-integration.js';

export interface FakeHostOptions {
  chat_context?: ChatContext;
  tools?: Tool[];
  /** Recusa contexto quando o principal não informa tenant. */
  require_tenant?: boolean;
  /** Falha injetada, para testar propagação de erro do Host. */
  fail_with?: HostIntegrationError;
  /** Saída devolvida por nome de ferramenta. */
  outputs?: Record<string, HostToolOutput>;
}

export interface FakeHost extends HostIntegration {
  /** Chamadas efetivamente executadas (efeito colateral observável). */
  readonly executed_calls: ToolCall[];
  readonly context_requests: HostContextRequest[];
}

/**
 * Adaptador em memória para testes de contrato.
 *
 * Existe apenas em `test/`: não é registrado no módulo NestJS nem usado pelo
 * fluxo de mensagens. Simula o Host revalidando acesso no instante da execução.
 */
export function createFakeHost(options: FakeHostOptions = {}): FakeHost {
  const chatContext = options.chat_context ?? {};
  const tools = options.tools ?? [];
  const executedCalls: ToolCall[] = [];
  const contextRequests: HostContextRequest[] = [];

  function rejectIfFailing(): void {
    if (options.fail_with) {
      throw options.fail_with;
    }
  }

  return {
    executed_calls: executedCalls,
    context_requests: contextRequests,

    async loadConversationContext(
      request: HostContextRequest,
    ): Promise<HostConversationContext> {
      contextRequests.push(request);
      rejectIfFailing();

      if (options.require_tenant && !request.principal.tenant_id) {
        throw new HostIntegrationError(
          'forbidden',
          'Host exige tenant_id e o principal não informa um.',
        );
      }

      return { chat_context: chatContext, tools };
    },

    async executeTool(
      request: HostToolExecutionRequest,
    ): Promise<HostToolOutput> {
      rejectIfFailing();

      const call = request.tool_call;
      const tool = tools.find((candidate) => candidate.name === call.tool_name);

      if (!tool) {
        throw new HostIntegrationError(
          'not_found',
          `Ferramenta "${call.tool_name}" não está disponível para este principal.`,
        );
      }

      const granted = new Set(chatContext.permissions ?? []);
      const missing = tool.required_permissions.filter(
        (permission) => !granted.has(permission),
      );

      if (missing.length > 0) {
        throw new HostIntegrationError(
          'forbidden',
          `Chamada recusada: faltam grants ${missing.join(', ')}.`,
        );
      }

      executedCalls.push(call);
      return options.outputs?.[call.tool_name] ?? null;
    },
  };
}
