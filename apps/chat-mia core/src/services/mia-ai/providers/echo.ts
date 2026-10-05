/**
 * Provider `echo` — resposta fixa, sem chamar modelo nenhum.
 *
 * Existe para exercitar o Core inteiro sem chave e sem gastar cota: a rota, o
 * contexto, a persistência da resposta e as sugestões são as mesmas de sempre,
 * só o texto da Mia AI que é fixo. O `config` chega no eco, o que torna este
 * modo também o jeito mais barato de conferir o repasse de configuração.
 */

import { readSuggestions } from '../../../models/suggestion.js';
import { formatChatConfig } from '../../../models/chat-config.js';
import type {
  AIProvider,
  AIProviderRequest,
  AIProviderResponse,
} from '../provider.js';

/** Provider que responde texto fixo. */
export function createEchoProvider(
  env: NodeJS.ProcessEnv = process.env,
): AIProvider {
  // Lidas no arranque para que o teste do `MIA_AI_NO_SUGGESTIONS` valha para
  // todas as requisições, e não só para a próxima.
  const noSuggestions = env.MIA_AI_NO_SUGGESTIONS === '1';

  return {
    name: 'echo',

    describe: () => 'texto fixo, sem chamar modelo',

    async respond({
      message,
      config,
    }: AIProviderRequest): Promise<AIProviderResponse> {
      // O eco mostra o config entre parênteses: é o jeito de conferir o repasse
      // sem chave do provider.
      const response = `[echo] Recebi: "${message}" (${formatChatConfig(config)})`;

      if (noSuggestions) return { response, suggestions: null };

      return {
        response,
        suggestions: readSuggestions([
          'Ver meu agendamento',
          'Falar com a recepção',
        ]),
      };
    },
  };
}
