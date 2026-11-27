import { Module } from '@nestjs/common';
import { HostContextService } from './host-context.service.js';
import {
  loadHostContextLimits,
  loadHostContextTimeoutMs,
} from './host-context.config.js';
import {
  loadHostExecutionLimits,
  loadHostExecutionTimeoutMs,
} from './host-execution.config.js';
import { createUnconfiguredHostIntegration } from './host-integration.provider.js';
import { HostToolCatalogService } from './host-tool-catalog.service.js';
import { HostToolExecutionService } from './host-tool-execution.service.js';
import {
  HOST_CONTEXT_LIMITS,
  HOST_CONTEXT_TIMEOUT_MS,
  HOST_EXECUTION_LIMITS,
  HOST_EXECUTION_TIMEOUT_MS,
  HOST_INTEGRATION,
} from './host.tokens.js';

/**
 * Módulo da integração com o Host.
 *
 * O provider de `HOST_INTEGRATION` é o único ponto que precisa ser substituído
 * quando o Host real e o transporte forem escolhidos. Até lá, a implementação
 * padrão recusa chamadas explicitamente (`host_unavailable`) em vez de
 * devolver contexto vazio.
 */
@Module({
  providers: [
    HostContextService,
    HostToolCatalogService,
    HostToolExecutionService,
    {
      provide: HOST_INTEGRATION,
      useFactory: createUnconfiguredHostIntegration,
    },
    {
      provide: HOST_CONTEXT_LIMITS,
      useFactory: () => loadHostContextLimits(),
    },
    {
      provide: HOST_CONTEXT_TIMEOUT_MS,
      useFactory: () => loadHostContextTimeoutMs(),
    },
    {
      provide: HOST_EXECUTION_LIMITS,
      useFactory: () => loadHostExecutionLimits(),
    },
    {
      provide: HOST_EXECUTION_TIMEOUT_MS,
      useFactory: () => loadHostExecutionTimeoutMs(),
    },
  ],
  exports: [
    HostContextService,
    HostToolCatalogService,
    HostToolExecutionService,
  ],
})
export class HostModule {}
