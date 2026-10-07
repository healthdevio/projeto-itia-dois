import type {
  ChatConfigLanguage,
  ChatConfigResponseLength,
  ChatConfigTone,
} from './chat-config.js';
export interface PromptTemplate {
  persona: string;
  languageHints?: Partial<Record<ChatConfigLanguage, string>>;
  toneHints?: Partial<Record<ChatConfigTone, string>>;
  lengthHints?: Partial<Record<ChatConfigResponseLength, string>>;
  suggestions?: string;
  suggestionsSystem?: string;
}
export type ResolvedPromptTemplate = Required<
  Omit<PromptTemplate, 'languageHints' | 'toneHints' | 'lengthHints'>
> & {
  languageHints: Partial<Record<ChatConfigLanguage, string>>;
  toneHints: Partial<Record<ChatConfigTone, string>>;
  lengthHints: Partial<Record<ChatConfigResponseLength, string>>;
};
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
export function withPromptDefaults(
  template: PromptTemplate,
): ResolvedPromptTemplate {
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
