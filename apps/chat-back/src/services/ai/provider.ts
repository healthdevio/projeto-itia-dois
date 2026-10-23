import type { ChatConfig } from '../../models/chat-config.js';
import type { Suggestion } from '../../models/suggestion.js';
import type { AIContext } from './context.js';
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}
export interface AIProviderRequest {
  message: string;
  context: AIContext;
  config: ChatConfig;
  tenant?: string;
}
export interface AIProviderResponse {
  response: string;
  suggestions: Suggestion[] | null;
}
export interface AIProvider {
  readonly name: string;
  respond(request: AIProviderRequest): Promise<AIProviderResponse>;
  describe(): string;
}
const REGISTRY = {
  nvidia: () =>
    import('./providers/nvidia.js').then((m) => m.createNvidiaProvider),
  echo: () => import('./providers/echo.js').then((m) => m.createEchoProvider),
} satisfies Record<
  string,
  () => Promise<(env: NodeJS.ProcessEnv) => AIProvider>
>;
export type AIProviderName = keyof typeof REGISTRY;
export const AI_PROVIDER_NAMES = Object.keys(REGISTRY) as AIProviderName[];
export async function createProvider(
  env: NodeJS.ProcessEnv = process.env,
): Promise<AIProvider> {
  const requested = (env.AI_PROVIDER?.trim() || 'nvidia') as AIProviderName;
  const factory = REGISTRY[requested];
  if (!factory) {
    throw new Error(
      `AI_PROVIDER deve ser um de: ${AI_PROVIDER_NAMES.join(', ')} (veio "${requested}")`,
    );
  }
  return (await factory())(env);
}
