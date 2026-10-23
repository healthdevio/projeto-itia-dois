import { readSuggestions } from '../../../models/suggestion.js';
import { formatChatConfig } from '../../../models/chat-config.js';
import type {
  AIProvider,
  AIProviderRequest,
  AIProviderResponse,
} from '../provider.js';
export function createEchoProvider(
  env: NodeJS.ProcessEnv = process.env,
): AIProvider {
  const noSuggestions = env.AI_NO_SUGGESTIONS === '1';
  return {
    name: 'echo',
    describe: () => 'texto fixo, sem chamar modelo',
    async respond({
      message,
      config,
    }: AIProviderRequest): Promise<AIProviderResponse> {
      const response = `[echo] Recebi: "${message}" (${formatChatConfig(config)})`;
      if (noSuggestions) return { response, suggestions: null };
      return {
        response,
        suggestions: readSuggestions([
          'Ver meus detalhes',
          'Falar com o suporte',
        ]),
      };
    },
  };
}
