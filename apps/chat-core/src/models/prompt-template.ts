/**
 * Prompt Template Model
 *
 * O texto que o Core manda ao modelo. Um template por tenant: cada um tem a
 * sua persona, e as instruções derivadas do `config` da interface.
 *
 * ## Por que isto é um modelo, e não uma constante
 *
 * O texto do prompt é a parte do Core que mais muda entre implantações. Um
 * produto fala de agenda e prazos; outro fala de pedidos e entregas. Se o
 * texto morasse dentro do código de montagem, cada implantação seria um
 * *fork*, porque não haveria como escolher a persona sem editar a função.
 *
 * Como template, a persona é dado: `registerPrompt` escolhe, `resolvePrompt`
 * entrega, e a montagem em `src/services/ai/prompt.ts` continua igual para
 * todos. Um tenant novo é um registro, não uma alteração de lógica.
 *
 * ## O que é do template e o que não é
 *
 * Do template: a persona, o texto das sugestões, e opcionalmente as
 * instruções de idioma, tom e tamanho.
 *
 * **Não** é do template: o histórico da conversa e a mensagem atual. São
 * dados, não texto — e um template não pode sobrescrever o que o usuário
 * realmente disse.
 *
 * ## Ausência não é erro
 *
 * Todo campo é opcional, e o que falta cai em `DEFAULT_PROMPT`. Um tenant sem
 * registro, um id desconhecido ou um template parcial produzem um prompt
 * funcional: degrade para o padrão em vez de derrubar o chat.
 *
 * ```ts
 * registerPrompt('acme', { persona: 'Você é o assistente da Acme.' });
 * ```
 */

import type {
  ChatConfigLanguage,
  ChatConfigResponseLength,
  ChatConfigTone,
} from './chat-config.js';

/**
 * O texto que o modelo recebe.
 *
 * Só o que varia entre tenants. O histórico, a mensagem atual e a forma como
 * as peças são montadas são do Core, não do template.
 */
export interface PromptTemplate {
  /**
   * A persona: quem o modelo é e o que não pode fazer.
   *
   * É a primeira peça do system prompt, antes das instruções de config.
   */
  persona: string;

  /**
   * Idioma → instrução de idioma.
   *
   * Ausente no template usa `DEFAULT_PROMPT`. Preencher aqui é o que evita o
   * defeito de um template em português receber `en-US` e dizer "Responda em
   * português do Brasil" ao modelo.
   */
  languageHints?: Partial<Record<ChatConfigLanguage, string>>;

  /** Tom → instrução de tom. Mesma regra de ausência. */
  toneHints?: Partial<Record<ChatConfigTone, string>>;

  /** Tamanho → instrução de tamanho. Mesma regra de ausência. */
  lengthHints?: Partial<Record<ChatConfigResponseLength, string>>;

  /**
   * Instruções da chamada que pede as sugestões.
   *
   * Separada da persona porque é outra chamada, com outro objetivo: a resposta
   * é texto para o usuário, e as sugestões são JSON para a interface.
   */
  suggestions?: string;

  /** System prompt da chamada que devolve as sugestões. */
  suggestionsSystem?: string;
}

/**
 * Um template com todos os campos resolvidos.
 *
 * É o que a montagem consome: nenhum acesso precisa lidar com `undefined`, e
 * um template parcial nunca chega aqui. Os mapas continuam `Partial` de propósito
 * — um valor ausente em `toneHints` é um dado faltando, não um campo faltando.
 */
export type ResolvedPromptTemplate = Required<
  Omit<PromptTemplate, 'languageHints' | 'toneHints' | 'lengthHints'>
> & {
  languageHints: Partial<Record<ChatConfigLanguage, string>>;
  toneHints: Partial<Record<ChatConfigTone, string>>;
  lengthHints: Partial<Record<ChatConfigResponseLength, string>>;
};

/**
 * O template usado quando nada é registrado.
 *
 * É o texto que o Core envia hoje, sem configuração nenhuma — de modo que uma
 * implantação de tenant único não tenha o que configurar.
 */
export const DEFAULT_PROMPT: ResolvedPromptTemplate = {
  persona: [
    'Você é um assistente útil.',
    'Você recebe o histórico da conversa em previous_messages; a última mensagem',
    'do usuário é a pergunta atual. Não invente dados do usuário.',
  ].join(' '),

  languageHints: {
    'pt-BR': 'Responda em português do Brasil.',
    'en-US': 'Reply in English.',
  },

  toneHints: {
    formal: 'Fale formalmente, tratando o usuário por você.',
    neutral: 'Fale de forma direta e natural.',
    informal: 'Fale de forma informal e simpática.',
  },

  lengthHints: {
    short: 'Responda em 1 a 2 frases.',
    standard: 'Responda em 2 a 4 frases.',
    detailed: 'Responda em 5 a 8 frases, com os detalhes que importam.',
  },

  suggestions: [
    'Sugira de 2 a 3 ações que o usuário poderia tomar a seguir, por exemplo',
    '"ver meus detalhes" ou "falar com o suporte".',
    'Responda APENAS com um array JSON de strings: nada de texto em volta,',
    'nada de markdown, nada de explicação.',
  ].join('\n'),

  suggestionsSystem: 'Você devolve somente JSON válido.',
};

/**
 * Preenche os campos ausentes de um template com os do padrão.
 *
 * Mesma regra dos defaults do `ChatConfig`: ausente é o caso comum e não é
 * erro. Um template que define só a persona herda as instruções de idioma, tom
 * e tamanho — que são genéricas o bastante para servir a qualquer persona.
 *
 * Os mapas são mesclados campo a campo, não substituídos: um template que
 * sobrescreve só `formal` continua com `neutral` e `informal` do padrão.
 */
export function withPromptDefaults(
  template: PromptTemplate,
): ResolvedPromptTemplate {
  // Os campos são lidos um a um, e não por spread: `...template` traria
  // `undefined` explícito para o que o template não define, e o spread
  // sobrescreveria o default com ele. `??` é o que faz "ausente usa o padrão"
  // funcionar de verdade.
  return {
    persona: template.persona || DEFAULT_PROMPT.persona,
    suggestions: template.suggestions ?? DEFAULT_PROMPT.suggestions,
    suggestionsSystem:
      template.suggestionsSystem ?? DEFAULT_PROMPT.suggestionsSystem,
    languageHints: {
      ...DEFAULT_PROMPT.languageHints,
      ...template.languageHints,
    },
    toneHints: { ...DEFAULT_PROMPT.toneHints, ...template.toneHints },
    lengthHints: { ...DEFAULT_PROMPT.lengthHints, ...template.lengthHints },
  };
}
