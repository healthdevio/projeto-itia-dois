import { randomUUID } from 'node:crypto';
export interface Suggestion {
  suggestion_id: string;
  text: string;
}
export const MAX_SUGGESTIONS = 8;
export const MAX_SUGGESTION_TEXT_LENGTH = 500;
export const MAX_SUGGESTION_ID_LENGTH = 128;
function toSuggestion(value: unknown): Suggestion | null {
  if (typeof value === 'string') {
    return toSuggestion({ text: value });
  }
  if (typeof value !== 'object' || value === null) return null;
  const { suggestion_id: rawId, text: rawText } = value as {
    suggestion_id?: unknown;
    text?: unknown;
  };
  if (typeof rawText !== 'string') return null;
  const text = rawText.trim();
  if (text === '' || text.length > MAX_SUGGESTION_TEXT_LENGTH) return null;
  const id = typeof rawId === 'string' ? rawId.trim() : '';
  return {
    suggestion_id:
      id !== '' && id.length <= MAX_SUGGESTION_ID_LENGTH
        ? id
        : `sg-${randomUUID()}`,
    text,
  };
}
export function readSuggestions(value: unknown): Suggestion[] {
  if (!Array.isArray(value)) return [];
  const suggestions: Suggestion[] = [];
  for (const entry of value) {
    const suggestion = toSuggestion(entry);
    if (suggestion) suggestions.push(suggestion);
    if (suggestions.length === MAX_SUGGESTIONS) break;
  }
  return suggestions;
}
export type SuggestionValidation =
  | {
      ok: true;
      suggestions: Suggestion[];
    }
  | {
      ok: false;
      error: string;
    };
export function validateSuggestions(body: unknown): SuggestionValidation {
  if (typeof body !== 'object' || body === null) {
    return { ok: false, error: 'Corpo da requisição inválido' };
  }
  if (
    typeof (
      body as {
        text?: unknown;
      }
    ).text === 'string'
  ) {
    const single = toSuggestion(body);
    return single
      ? { ok: true, suggestions: [single] }
      : {
          ok: false,
          error: `text deve ter entre 1 e ${MAX_SUGGESTION_TEXT_LENGTH} caracteres`,
        };
  }
  const list = (
    body as {
      suggestions?: unknown;
    }
  ).suggestions;
  if (!Array.isArray(list)) {
    return {
      ok: false,
      error: 'Campo obrigatório faltando: suggestions (array) ou text (string)',
    };
  }
  if (list.length === 0) {
    return { ok: false, error: 'A lista suggestions está vazia' };
  }
  if (list.length > MAX_SUGGESTIONS) {
    return {
      ok: false,
      error: `No máximo ${MAX_SUGGESTIONS} sugestões por requisição`,
    };
  }
  const suggestions: Suggestion[] = [];
  for (const [index, entry] of list.entries()) {
    const suggestion = toSuggestion(entry);
    if (!suggestion) {
      return {
        ok: false,
        error: `suggestions[${index}] inválida: use { "text": "..." } ou a string do texto, com até ${MAX_SUGGESTION_TEXT_LENGTH} caracteres`,
      };
    }
    suggestions.push(suggestion);
  }
  return { ok: true, suggestions };
}
