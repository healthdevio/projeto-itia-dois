import { Inject, Injectable } from '@nestjs/common';

import type { RequestIdentity } from '../../middleware/identity.js';
import type { ChatContext } from '../../models/chat-context.js';
import type { PermissionCode } from '../../models/permission.js';
import type { Tool } from '../../models/tool.js';
import type { ToolCall } from '../../models/tool-call.js';
import { isToolSchemaCompilable } from '../tools/tool-arguments-validator.js';
import { authorizeToolCall } from '../tools/tool-authorization.js';
import { HostContextService } from './host-context.service.js';

export interface HostToolCatalogRequest {
  /** Identidade verificada pelo Core, nunca enviada pelo cliente. */
  identity: RequestIdentity;
  conversationId: string;
  signal?: AbortSignal;
}

/** Contagens agregadas; nenhum nome/schema/argumento é registrado. */
export interface HostToolCatalogDiscards {
  invalid_schema: number;
  not_allowed: number;
}

export interface HostToolCatalogResult {
  tools: Tool[];
  chat_context: ChatContext;
  discarded: HostToolCatalogDiscards;
  /**
   * Proveniência do carregamento. A execução confere estes campos antes de
   * aceitar um catálogo recebido de outra camada do mesmo processo.
   */
  identity: RequestIdentity;
  conversationId: string;
}

/**
 * Entrega o catálogo de ferramentas do Host já validado e filtrado pelos grants
 * do mesmo carregamento de contexto.
 *
 * O recebimento, o deadline, os limites e a validação estrutural são feitos por
 * `HostContextService`; aqui só restam a compilação do JSON Schema pelo Ajv e a
 * autorização. Não há cache: o resultado vive apenas durante o turno e não pode
 * ser reutilizado entre usuários ou tenants.
 */
@Injectable()
export class HostToolCatalogService {
  constructor(
    @Inject(HostContextService)
    private readonly hostContext: HostContextService,
  ) {}

  async getAvailableTools(
    request: HostToolCatalogRequest,
  ): Promise<HostToolCatalogResult> {
    const context = await this.hostContext.load(
      request.identity,
      request.conversationId,
      request.signal,
    );
    const discarded: HostToolCatalogDiscards = {
      invalid_schema: 0,
      not_allowed: 0,
    };
    const tools: Tool[] = [];

    for (const tool of context.tools) {
      if (!isToolSchemaCompilable(tool.input_schema)) {
        discarded.invalid_schema += 1;
        continue;
      }
      if (
        !this.isAllowed(
          tool,
          context.chat_context.permissions,
          request.conversationId,
        )
      ) {
        discarded.not_allowed += 1;
        continue;
      }
      tools.push(tool);
    }

    console.log(
      `[Host] catálogo · usuário ${request.identity.userId} · ` +
        `tenant ${request.identity.tenantId ?? 'default'} · ` +
        `conversa ${request.conversationId} · ` +
        `${tools.length}/${context.tools.length} ferramentas expostas · ` +
        `schema_invalido=${discarded.invalid_schema} · ` +
        `sem_permissao=${discarded.not_allowed}`,
    );

    return {
      tools,
      chat_context: context.chat_context,
      discarded,
      identity: request.identity,
      conversationId: request.conversationId,
    };
  }

  /**
   * `authorizeToolCall` decide apenas com `tool_name` e grants; o `ToolCall`
   * montado aqui é um veículo para reutilizar essa decisão e nunca é executado.
   */
  private isAllowed(
    tool: Tool,
    permissions: PermissionCode[] | undefined,
    conversationId: string,
  ): boolean {
    const catalogCheck: ToolCall = {
      id: 'catalog-check',
      tool_name: tool.name,
      arguments: {},
      context: { conversation_id: conversationId },
    };
    return authorizeToolCall(tool, catalogCheck, { permissions }).authorized;
  }
}
