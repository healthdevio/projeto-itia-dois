import { HostIntegrationError } from '../../models/host-integration.js';

/**
 * Traduz uma falha de contexto do Host para a resposta HTTP do Core, sem
 * expor detalhes internos do Host ao cliente.
 */
export function hostErrorHttpStatus(error: HostIntegrationError): number {
  switch (error.code) {
    case 'forbidden':
      return 403;
    case 'timeout':
      return 504;
    case 'unauthorized':
    case 'not_found':
    case 'invalid_arguments':
    case 'host_unavailable':
    case 'unknown':
      return 502;
    default:
      return 502;
  }
}

export function hostErrorMessage(error: HostIntegrationError): string {
  switch (error.code) {
    case 'forbidden':
      return 'Acesso ao contexto do Host negado';
    case 'unauthorized':
      return 'O Host não reconheceu a identidade verificada';
    case 'timeout':
      return 'Tempo esgotado ao carregar o contexto do Host';
    case 'host_unavailable':
      return 'Sistema hospedeiro indisponível';
    case 'not_found':
    case 'invalid_arguments':
    case 'unknown':
      return 'Não foi possível carregar o contexto do Host';
    default:
      return 'Não foi possível carregar o contexto do Host';
  }
}
