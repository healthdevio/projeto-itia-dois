import {
  HostIntegrationError,
  type HostConversationContext,
  type HostIntegration,
  type HostToolOutput,
} from '../../models/host-integration.js';

/**
 * Implementação padrão da porta `HostIntegration` enquanto o Host real e o
 * transporte não forem escolhidos (Task 01 em aberto).
 *
 * Ela nunca devolve contexto vazio: rejeita com `host_unavailable`, para que
 * uma integração habilitada sem adaptador falhe de forma explícita.
 */
export function createUnconfiguredHostIntegration(): HostIntegration {
  const unavailable = (operation: string): HostIntegrationError =>
    new HostIntegrationError(
      'host_unavailable',
      `Integração com o Host não configurada para ${operation}.`,
    );

  return {
    async loadConversationContext(): Promise<HostConversationContext> {
      throw unavailable('carregar contexto');
    },
    async executeTool(): Promise<HostToolOutput> {
      throw unavailable('executar ferramenta');
    },
  };
}
