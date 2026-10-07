import type { ChatConfig } from '../../models/chat-config.js';
import type { Message } from '../../models/message.js';
import type { Suggestion } from '../../models/suggestion.js';
import { createProvider, type AIProvider } from './provider.js';
import type { AIContext } from './context.js';
export { AIError } from './error.js';
export {
  buildContext,
  DEFAULT_CONTEXT_WINDOW,
  type AIContext,
} from './context.js';
export {
  AI_PROVIDER_NAMES,
  createProvider,
  type AIProvider,
  type AIProviderName,
  type AIProviderRequest,
  type AIProviderResponse,
  type ChatMessage,
} from './provider.js';
export {
  registerPrompt,
  registeredTenants,
  resolvePrompt,
  unregisterPrompt,
} from './prompts.js';
export interface AIRequest {
  message: Message;
  context: AIContext;
  config: ChatConfig;
  tenant?: string;
}
export interface AIResponse {
  response: string;
  suggestions: Suggestion[] | null;
}
let providerPromise: Promise<AIProvider> | undefined;
export function getProvider(
  env: NodeJS.ProcessEnv = process.env,
): Promise<AIProvider> {
  providerPromise ??= createProvider(env);
  return providerPromise;
}
export async function sendToAI(
  request: AIRequest,
  provider?: AIProvider,
): Promise<AIResponse> {
  const active = provider ?? (await getProvider());
  return active.respond({
    message: request.message.message,
    context: request.context,
    config: request.config,
    tenant: request.tenant,
  });
}
