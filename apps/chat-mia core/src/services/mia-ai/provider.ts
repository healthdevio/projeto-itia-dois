/**
 * Contrato com um gerador de resposta (provider).
 *
 * A Mia AI — a parte que sabe falar com um modelo de linguagem — é
 * **modular** dentro do Core: o resto do servidor só conhece a interface
 * `AIProvider` deste arquivo. Provider, modelo, prompt e chave de API vivem
 * atrás dela, em `providers/`.
 *
 * ## Por que a fronteira é uma interface
 *
 * O provider que roda agora é um substituto temporário de teste, que fala com o
 * backend da Nvidia. Ele vive isolado em `providers/nvidia.ts` justamente para
 * poder ser trocado — ou apagado — sem que o resto do Core mude: rotas,
 * conversa, sugestões e persistência não importam nada de provider, só daqui.
 *
 * Um provider novo (a Mia AI de verdade, um modelo local, um mock) é um arquivo
 * novo em `providers/` mais uma linha no registro de `createProvider`. Nada mais.
 */

import type { ChatConfig } from '../../models/chat-config.js';
import type { Suggestion } from '../../models/suggestion.js';
import type { MiaAIContext } from './context.js';

/** Mensagem de chat no formato aceito pelos providers. */
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/**
 * O que o Core pede a um provider: a mensagem nova, o contexto do diálogo e a
 * configuração que a interface escolheu.
 *
 * É o mesmo trio que ia por HTTP quando a Mia AI era um serviço separado — a
 * forma não muda, só deixa de haver rede no meio.
 */
export interface AIProviderRequest {
  /** A mensagem nova do usuário. */
  message: string;

  /** Contexto mínimo da conversa, montado pelo Core. */
  context: MiaAIContext;

  /** Configuração efetiva deste envio. Sempre completa. */
  config: ChatConfig;
}

/** O que o provider devolve. */
export interface AIProviderResponse {
  /** Texto da resposta, pronto para a interface. */
  response: string;

  /**
   * Sugestões para a próxima ação do usuário.
   *
   * `null` significa "o provider não falou de sugestões" — a resposta veio sem o
   * campo, e o Core preserva as sugestões que já tinha. Uma lista vazia é uma
   * decisão: limpa as sugestões daquela conversa.
   */
  suggestions: Suggestion[] | null;
}

/**
 * Um gerador de resposta.
 *
 * Uma única responsabilidade: receber mensagem + contexto + config e devolver
 * texto e, se quiser, sugestões.
 */
export interface AIProvider {
  /** Identificador do provider, para log e para o registro. */
  readonly name: string;

  /**
   * Gera a resposta.
   *
   * Deve lançar erro com a causa do provider preservada (chave inválida, limite
   * de taxa, timeout): o Core a repassa no `502`, e é ela que diz à interface o
   * que aconteceu.
   */
  respond(request: AIProviderRequest): Promise<AIProviderResponse>;

  /** Descrição curta para o log de boot. */
  describe(): string;
}

/** Registro dos providers disponíveis, por nome. */
const REGISTRY = {
  /** Substituto de teste, fala com o backend da Nvidia. */
  nvidia: () =>
    import('./providers/nvidia.js').then((m) => m.createNvidiaProvider),
  /** Responde texto fixo, sem chamar nada. Para testar sem gastar cota. */
  echo: () => import('./providers/echo.js').then((m) => m.createEchoProvider),
} satisfies Record<
  string,
  () => Promise<(env: NodeJS.ProcessEnv) => AIProvider>
>;

export type AIProviderName = keyof typeof REGISTRY;

/** Nomes aceitos em `MIA_AI_PROVIDER`. */
export const AI_PROVIDER_NAMES = Object.keys(REGISTRY) as AIProviderName[];

/**
 * Instancia o provider pedido no ambiente.
 *
 * A carga é dinâmica de propósito: um provider que não está em uso não entra no
 * bundle nem é avaliado, e um provider removido não deixa import quebrado no
 * registro.
 *
 * @throws Error quando `MIA_AI_PROVIDER` não é um provider conhecido.
 */
export async function createProvider(
  env: NodeJS.ProcessEnv = process.env,
): Promise<AIProvider> {
  const requested = (env.MIA_AI_PROVIDER?.trim() || 'nvidia') as AIProviderName;

  const factory = REGISTRY[requested];

  if (!factory) {
    throw new Error(
      `MIA_AI_PROVIDER deve ser um de: ${AI_PROVIDER_NAMES.join(', ')} (veio "${requested}")`,
    );
  }

  return (await factory())(env);
}
