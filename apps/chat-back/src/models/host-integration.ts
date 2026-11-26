import type { ChatContext } from './chat-context.js';
import type { Tool } from './tool.js';
import type { ToolCall } from './tool-call.js';

/**
 * Versão do contrato entre o Core e o adaptador do Host.
 *
 * Deve ser incrementada quando uma mudança quebrar consumidores existentes.
 * O adaptador informa ao Host qual versão está implementando; a negociação
 * concreta depende do protocolo escolhido na task de integração.
 */
export const HOST_INTEGRATION_CONTRACT_VERSION = '1.0.0';

/**
 * Identidade verificada pelo Core a partir do JWT OIDC.
 *
 * Nunca é construída pelo navegador, pelo corpo da requisição ou pela IA.
 */
export interface HostPrincipal {
  user_id: string;
  tenant_id?: string;
}

/**
 * Códigos mínimos de falha do contrato.
 *
 * O formato de erro específico de cada Host continua fora do escopo: o
 * adaptador traduz a resposta do Host para um destes códigos.
 */
export type HostErrorCode =
  | 'unauthorized'
  | 'forbidden'
  | 'not_found'
  | 'invalid_arguments'
  | 'timeout'
  | 'host_unavailable'
  | 'unknown';

/**
 * Falha tipada do contrato.
 *
 * - `message` descreve o problema sem expor credenciais ou dados fora do escopo.
 * - `cause` é opcional e serve para diagnóstico interno; não deve ser
 *   repassado ao cliente nem ao modelo.
 */
export class HostIntegrationError extends Error {
  constructor(
    readonly code: HostErrorCode,
    message: string,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = 'HostIntegrationError';
  }
}

export interface HostContextRequest {
  principal: HostPrincipal;
  conversation_id: string;
  /**
   * Cancelamento opcional da chamada. Quando abortado, o adaptador deve
   * rejeitar com `HostIntegrationError` em vez de resolver com dados parciais.
   */
  signal?: AbortSignal;
}

export interface HostConversationContext {
  chat_context: ChatContext;
  tools: Tool[];
}

export interface HostToolExecutionRequest {
  principal: HostPrincipal;
  /**
   * A chamada identifica a operação. `tool_call.id` é a chave de idempotência:
   * o Host pode usá-la para não repetir uma execução já aplicada.
   */
  tool_call: ToolCall;
  /**
   * Cancelamento opcional. Cancelar não garante que o Host desfez um efeito
   * já aplicado; o Core deve tratar a chamada como resultado desconhecido.
   */
  signal?: AbortSignal;
}

export type HostToolOutput =
  | string
  | number
  | boolean
  | null
  | HostToolOutput[]
  | { [key: string]: HostToolOutput };

export interface HostIntegration {
  /**
   * Carrega o contexto permitido e o catálogo de ferramentas do principal.
   *
   * Resolve com `HostConversationContext` (a lista `tools` pode ser vazia).
   * Rejeita com `HostIntegrationError` quando a identidade é inválida
   * (`unauthorized`), o escopo/tenant não é permitido (`forbidden`), o Host
   * não responde (`host_unavailable`), a chamada expira (`timeout`) ou a
   * falha não se encaixa nos demais códigos (`unknown`).
   */
  loadConversationContext(
    request: HostContextRequest,
  ): Promise<HostConversationContext>;

  /**
   * Encaminha uma chamada já autorizada e validada pelo Core.
   *
   * O Core só chama este método depois de localizar a ferramenta no catálogo,
   * checar grants e validar argumentos. O Host revalida o acesso no instante
   * da execução.
   *
   * Resolve com `HostToolOutput` (valor JSON) ou rejeita com
   * `HostIntegrationError`: `unauthorized`/`forbidden` para identidade ou
   * acesso inválido, `not_found` para ferramenta ou recurso inexistente,
   * `invalid_arguments` para argumentos recusados na revalidação, `timeout` e
   * `host_unavailable` para falhas de comunicação, `unknown` para o restante.
   * Nunca resolve com sucesso vazio para representar falha.
   */
  executeTool(request: HostToolExecutionRequest): Promise<HostToolOutput>;
}
