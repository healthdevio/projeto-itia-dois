/**
 * Mia AI — o ponto do Core que fala com o modelo de linguagem.
 *
 * ## O que o Core sabe e o que ele não sabe
 *
 * O Core **não sabe o que é um modelo de linguagem.** Ele não conhece provider,
 * modelo, prompt, temperatura nem formato de requisição de nenhuma API de IA.
 * Isso mora atrás de `AIProvider` (ver `./provider.ts`), e o provider que roda
 * agora é um substituto temporário de teste, escolhido por `MIA_AI_PROVIDER`.
 *
 * O que fica aqui é o que o Core de fato tem: o estado da conversa, o `config`
 * que a interface pediu e a lista de sugestões. O Core monta o contexto, escolhe
 * o provider, e decide o que fazer com a resposta — inclusive substituir as
 * sugestões da conversa pelas novas.
 *
 * ## Como está organizado
 *
 * ```
 * index.ts          API pública: buildContext, sendToMiaAI, MiaAIError
 * context.ts        MiaAIContext e a montagem do contexto a partir da conversa
 * provider.ts       interface AIProvider + registro dos providers
 * prompt.ts         { message, context, config } → mensagens de chat
 * providers/
 *   nvidia.ts       substituto de teste: backend da Nvidia
 *   echo.ts         texto fixo, sem chamar nada
 * ```
 *
 * ## Tempo de espera
 *
 * Quem espera pelo provider é o provider, com o tempo que o modelo precisa: a
 * geração de uma resposta longa leva mais de 60 s, e cortar aí devolvia erro no
 * meio da digitação. Ver `NVIDIA_TIMEOUT_MS` em `providers/nvidia.ts`.
 *
 * Antigamente havia um salto HTTP para um serviço da Mia AI separado, com
 * `MIA_AI_ENDPOINT` e `MIA_AI_SERVICE_TOKEN`. Não há mais: o provider roda no
 * mesmo processo, e o contrato é a interface, não a rede.
 */

import type { ChatConfig } from '../../models/chat-config.js';
import type { Message } from '../../models/message.js';
import type { Suggestion } from '../../models/suggestion.js';
import { createProvider, type AIProvider } from './provider.js';
import type { MiaAIContext } from './context.js';

export { MiaAIError } from './error.js';
export {
  buildContext,
  DEFAULT_CONTEXT_WINDOW,
  type MiaAIContext,
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

/** Payload que o Core monta para o provider. */
export interface MiaAIRequest {
  /** A mensagem nova do usuário. */
  message: Message;

  /** Contexto da conversa. */
  context: MiaAIContext;

  /** Configuração escolhida pela interface. Sempre completa. */
  config: ChatConfig;
}

/** Resposta que o Core usa para persistir e devolver à interface. */
export interface MiaAIResponse {
  /** Texto da resposta. */
  response: string;

  /**
   * Sugestões que a Mia AI anexou.
   *
   * `null` = ela não falou de sugestões, e o Core preserva as que já tinha.
   * Uma lista vazia é uma decisão: limpa as sugestões da conversa.
   */
  suggestions: Suggestion[] | null;
}

/** Resolve o provider uma vez e reaproveita nas requisições seguintes. */
let providerPromise: Promise<AIProvider> | undefined;

/**
 * O provider em uso, instanciado na primeira chamada.
 *
 * A instância é memorizada porque a configuração do provider é validada ao ser
 * lida (a chave do modelo, por exemplo): refazer isso a cada mensagem gastaria
 * uma leitura de ambiente por requisição para reprovar a mesma configuração.
 */
export function getProvider(
  env: NodeJS.ProcessEnv = process.env,
): Promise<AIProvider> {
  providerPromise ??= createProvider(env);

  return providerPromise;
}

/**
 * Manda a mensagem para a Mia AI e devolve texto e sugestões.
 *
 * É a única chamada que o Core faz para fora do seu processo — agora para um
 * provider local, sem rede no meio.
 *
 * O erro do provider atravessa como veio, com a causa preservada (ver
 * `providers/nvidia.ts`): quem chamou o modelo é quem sabe o que aconteceu, e
 * traduzir aqui só apagaria o motivo.
 *
 * @param request - Mensagem, contexto e config a enviar
 * @param provider - Provider a usar; o do ambiente por padrão
 */
export async function sendToMiaAI(
  request: MiaAIRequest,
  provider?: AIProvider,
): Promise<MiaAIResponse> {
  const active = provider ?? (await getProvider());

  return active.respond({
    message: request.message.message,
    context: request.context,
    config: request.config,
  });
}
