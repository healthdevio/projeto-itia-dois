/**
 * Chat Config Model
 *
 * Configuração que a **interface** escolhe e o Core repassa para a **Mia AI**.
 *
 * ```json
 * { "language": "pt-BR", "tone": "neutral", "response_length": "standard" }
 * ```
 *
 * O `config` diz **como** o usuário quer ser atendido: o idioma da resposta, o
 * tom, o tamanho. Ele não diz **com o que** a resposta é gerada — provider,
 * modelo, temperatura e prompt continuam sendo do lado do provider da Mia AI, e
 * nenhum deles chega às rotas. É a mesma fronteira de `src/services/mia-ai/`,
 * vista do lado de quem manda a configuração.
 *
 * ## Quem escreve e quem lê
 *
 * ```
 *    interface              Core              provider da Mia AI
 *    │                      │                      │
 *    │ POST /api/messages   │                      │
 *    │ { message, config }  │                      │
 *    │─────────────────────►│  valida e completa   │
 *    │                      │                      │
 *    │                      │  { message, context, │
 *    │                      │    config }          │
 *    │                      │─────────────────────►│
 *    │◄─────────────────────│  { …, config }       │
 * ```
 *
 * O provider mora dentro do Core (`src/services/mia-ai/`), mas continua sendo
 * uma fronteira: é ele que sabe o que `formal` quer dizer para o modelo, e não
 * o Core.
 *
 * A interface escreve, o provider lê — e **ninguém guarda**: o config não tem
 * tabela, não entra na conversa e não volta em `GET /api/conversations`. Ele
 * vale para a mensagem que o trouxe. É o que diferencia o config da conversa:
 * a conversa é estado do Core, o config é um despacho.
 *
 * ## Todo envio leva um config
 *
 * Ausente ou parcial, o Core completa com `DEFAULT_CHAT_CONFIG`. O provider não
 * precisa adivinhar se `tone` sumiu porque a interface não oferece a opção ou
 * porque o Core descartou — o que chega do outro lado está sempre completo.
 * O mesmo config que foi repassado volta na resposta, para a interface conferir
 * que a tela e o envio estão de acordo.
 *
 * Baseado na especificação em docs/core/ChatConfig.md
 */

/**
 * Idiomas em que a resposta pode ser escrita.
 *
 * A lista é fechada de propósito: a interface só oferece o que o chat atende,
 * e assim ninguém descobre que o idioma escolhido não funciona quando a
 * resposta chega. Acrescentar um idioma é mudança de contrato.
 */
export const CHAT_CONFIG_LANGUAGES = ['pt-BR', 'en-US'] as const;

export type ChatConfigLanguage = (typeof CHAT_CONFIG_LANGUAGES)[number];

/**
 * Tom da resposta.
 *
 * O Core sabe o que cada valor **significa** para quem está na tela, e não o
 * que o provider da Mia AI **faz** com ele. `formal` é uma etiqueta de
 * interface: virar system prompt é com o outro lado.
 */
export const CHAT_CONFIG_TONES = ['formal', 'neutral', 'informal'] as const;

export type ChatConfigTone = (typeof CHAT_CONFIG_TONES)[number];

/**
 * Tamanho esperado da resposta.
 *
 * `short` e `detailed` não são medidas de token: o Core não sabe o que cabe
 * na janela do modelo, e cada provider conta diferente.
 */
export const CHAT_CONFIG_RESPONSE_LENGTHS = [
  'short',
  'standard',
  'detailed',
] as const;

export type ChatConfigResponseLength =
  (typeof CHAT_CONFIG_RESPONSE_LENGTHS)[number];

/**
 * Configuração efetiva de um envio.
 *
 * Sempre completa: quem recebe sabe que todos os campos têm valor, sem precisar
 * saber se a interface mandou todos. É o que vai para o provider da Mia AI e o
 * que volta na resposta de `POST /api/messages`.
 */
export interface ChatConfig {
  /** Idioma em que a resposta deve ser escrita. */
  language: ChatConfigLanguage;

  /** Tom da resposta. */
  tone: ChatConfigTone;

  /** Tamanho esperado da resposta. */
  response_length: ChatConfigResponseLength;
}

/**
 * O que a interface pode mandar.
 *
 * Todo campo é opcional: quem envia escolhe só o que quer mudar, e o Core
 * completa o resto com o default.
 */
export type ChatConfigInput = Partial<ChatConfig>;

/**
 * Configuração usada quando a interface não diz nada.
 *
 * Português do Brasil, tom neutro e resposta de tamanho padrão é o que serve a
 * quem chegou no chat sem mexer em nada. Exigir os três campos da interface
 * para ter uma conversa só empurraria o default para dentro dela, e aí cada
 * cliente teria o seu.
 */
export const DEFAULT_CHAT_CONFIG: ChatConfig = {
  language: 'pt-BR',
  tone: 'neutral',
  response_length: 'standard',
};

/** Campo inválido no config. Vira `400` na rota, não `500`. */
class ChatConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ChatConfigError';
  }
}

/**
 * Lê um campo do config, aplicando o default quando ele não veio.
 *
 * A lista de valores aceitos vai junto porque o erro precisa dizer o que era
 * válido: "config.tone deve ser um de: formal, neutral, informal" é corrigível
 * pela interface, "config inválido" não é.
 *
 * @throws ChatConfigError quando o valor não é um dos aceitos.
 */
function readField<F extends keyof ChatConfig>(
  input: Record<string, unknown>,
  field: F,
  allowed: readonly ChatConfig[F][],
): ChatConfig[F] {
  const raw = input[field];

  // Ausente é o caso comum e não é erro: a interface envia só o que mudou.
  if (raw === undefined || raw === null) return DEFAULT_CHAT_CONFIG[field];

  if (typeof raw === 'string' && (allowed as readonly string[]).includes(raw)) {
    return raw as ChatConfig[F];
  }

  throw new ChatConfigError(
    `config.${field} deve ser um de: ${allowed.join(', ')}`,
  );
}

/** Resultado da validação de um config vindo da interface. */
export type ChatConfigValidation =
  { ok: true; config: ChatConfig } | { ok: false; error: string };

/**
 * Valida e completa o `config` de uma requisição da interface.
 *
 * A regra é curta, e ela existe para que uma tela meio configurada não derrube
 * a conversa:
 *
 * | O que veio                      | O que o Core faz             |
 * | ------------------------------- | --------------------------- |
 * | campo ausente, ou `config` fora | default                      |
 * | valor que não está na lista     | **`400`**, dizendo o que era |
 * | chave que o Core não conhece    | ignorada                     |
 *
 * Chave desconhecida é ignorada, e não recusada, porque o `config` é contrato
 * de dois lados: uma interface mais nova pode mandar um campo que este Core
 * ainda não conhece, e um Core mais velho não pode quebrar o chat por causa
 * disso. O inverso — um provider da Mia AI que não conhece o `config` — também
 * é seguro, porque o campo chega no topo do payload e ele pode simplesmente
 * ignorá-lo.
 *
 * Já um valor inválido em campo conhecido **é** erro: a interface está no
 * meio de um caminho que não existe, e um `400` explicando qual valor era
 * válido é mais barato que uma resposta em outro idioma.
 *
 * @param value - O campo `config` do corpo da requisição, já parseado.
 */
export function validateChatConfig(value: unknown): ChatConfigValidation {
  // `config` fora do corpo é o caminho normal: nem toda interface tem ajuste
  // para expor. `null` é o mesmo caso em uma interface tipada que ainda não
  // tem nada escolhido.
  if (value === undefined || value === null) {
    return { ok: true, config: { ...DEFAULT_CHAT_CONFIG } };
  }

  if (typeof value !== 'object' || Array.isArray(value)) {
    return {
      ok: false,
      error: 'config deve ser um objeto com language, tone e response_length',
    };
  }

  try {
    const input = value as Record<string, unknown>;

    return {
      ok: true,
      config: {
        language: readField(input, 'language', CHAT_CONFIG_LANGUAGES),
        tone: readField(input, 'tone', CHAT_CONFIG_TONES),
        response_length: readField(
          input,
          'response_length',
          CHAT_CONFIG_RESPONSE_LENGTHS,
        ),
      },
    };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof ChatConfigError
          ? error.message
          : 'Erro ao ler a configuração do chat',
    };
  }
}

/**
 * Resume um config em uma linha, para os logs.
 *
 * A rota e o provider registram o mesmo resumo, então um `[Core]` e um
 * `[Nvidia]` na mesma hora mostram que a configuração que a interface pediu é a
 * que chegou ao modelo.
 */
export function formatChatConfig(config: ChatConfig): string {
  return `${config.language} · ${config.tone} · ${config.response_length}`;
}
