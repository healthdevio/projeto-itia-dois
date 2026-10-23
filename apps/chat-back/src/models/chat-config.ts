export const CHAT_CONFIG_LANGUAGES = ['pt-BR', 'en-US'] as const;
export type ChatConfigLanguage = (typeof CHAT_CONFIG_LANGUAGES)[number];
export const CHAT_CONFIG_TONES = ['formal', 'neutral', 'informal'] as const;
export type ChatConfigTone = (typeof CHAT_CONFIG_TONES)[number];
export const CHAT_CONFIG_RESPONSE_LENGTHS = [
  'short',
  'standard',
  'detailed',
] as const;
export type ChatConfigResponseLength =
  (typeof CHAT_CONFIG_RESPONSE_LENGTHS)[number];
export interface ChatConfig {
  language: ChatConfigLanguage;
  tone: ChatConfigTone;
  response_length: ChatConfigResponseLength;
}
export type ChatConfigInput = Partial<ChatConfig>;
export const DEFAULT_CHAT_CONFIG: ChatConfig = {
  language: 'pt-BR',
  tone: 'neutral',
  response_length: 'standard',
};
class ChatConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ChatConfigError';
  }
}
function readField<F extends keyof ChatConfig>(
  input: Record<string, unknown>,
  field: F,
  allowed: readonly ChatConfig[F][],
): ChatConfig[F] {
  const raw = input[field];
  if (raw === undefined || raw === null) return DEFAULT_CHAT_CONFIG[field];
  if (typeof raw === 'string' && (allowed as readonly string[]).includes(raw)) {
    return raw as ChatConfig[F];
  }
  throw new ChatConfigError(
    `config.${field} deve ser um de: ${allowed.join(', ')}`,
  );
}
export type ChatConfigValidation =
  | {
      ok: true;
      config: ChatConfig;
    }
  | {
      ok: false;
      error: string;
    };
export function validateChatConfig(value: unknown): ChatConfigValidation {
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
export function formatChatConfig(config: ChatConfig): string {
  return `${config.language} · ${config.tone} · ${config.response_length}`;
}
