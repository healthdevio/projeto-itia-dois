/**
 * Suggestion Model
 *
 * Sugestão é a ação que a interface oferece ao usuário logo abaixo da última
 * resposta da AI. O usuário clica e o texto vai para o input como se ele
 * tivesse digitado.
 *
 * A sugestão é escrita pela **AI** e lida pela **interface**. O Core é o
 * meio: persiste o que ela devolveu e entrega o que está guardado na conversa
 * ativa do usuário. O Core não decide o que é uma boa sugestão — ele não sabe
 * o que é um modelo de linguagem.
 *
 * ```json
 * { "suggestion_id": "sg-1", "text": "Ver meus detalhes" }
 * ```
 *
 * Baseado na especificação em docs/core/Suggestion.md
 */

import { randomUUID } from 'node:crypto';

/**
 * Uma sugestão.
 *
 * Só dois campos, de propósito: o id, com que a interface identifica a
 * sugestão, e o texto, que é exibido e enviado como mensagem ao ser clicado.
 */
export interface Suggestion {
  /** Identifica a sugestão. Único dentro da conversa. */
  suggestion_id: string;

  /** Texto exibido na interface. É o que vai como mensagem ao clicar. */
  text: string;
}

/** Quantas sugestões o Core guarda por conversa, no máximo. */
export const MAX_SUGGESTIONS = 8;

/** Tamanho máximo do texto de uma sugestão. */
export const MAX_SUGGESTION_TEXT_LENGTH = 500;

/** Tamanho máximo do `suggestion_id`. */
export const MAX_SUGGESTION_ID_LENGTH = 128;

/**
 * Converte um valor vindo de fora em `Suggestion`.
 *
 * O `suggestion_id` é opcional na entrada: quando falta, o Core gera um. A
 * AI não precisa inventar id, e a interface pode registrar uma sugestão
 * sem se preocupar com isso.
 *
 * Uma string solta também vale como sugestão, com o próprio texto:
 * `["ver meus detalhes"]` é lido como `[{ text: "ver meus detalhes" }]`.
 * A AI é de outro time, e aceitar as duas formas evita que uma lista
 * perfeitamente razoável vire zero sugestão sem ninguém perceber.
 *
 * @returns A sugestão normalizada, ou `null` se o valor não é uma sugestão.
 */
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
    // O id da AI é aceito quando cabe no limite; senão é substituído por
    // um gerado aqui. Um id de 4 KB viraria lixo na chave primária.
    suggestion_id:
      id !== '' && id.length <= MAX_SUGGESTION_ID_LENGTH
        ? id
        : `sg-${randomUUID()}`,
    text,
  };
}

/**
 * Lê uma lista de sugestões de uma resposta que o Core não controla.
 *
 * É o caminho usado para o que a **AI** devolve: entradas malformadas são
 * descartadas em silêncio, porque uma sugestão ruim não deve derrubar a
 * resposta que a acompanhou. O que sobra é limitado a `MAX_SUGGESTIONS`.
 *
 * @returns As sugestões válidas, na ordem em que vieram.
 */
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

/** Resultado da validação de uma lista de sugestões vinda da interface. */
export type SuggestionValidation =
  | { ok: true; suggestions: Suggestion[] }
  | { ok: false; error: string };

/**
 * Valida uma lista de sugestões vinda da **interface**.
 *
 * Diferente de `readSuggestions`, aqui o erro é reportado: quem chamou está
 * esperando uma gravação e precisa saber o que estava errado. Uma lista vazia
 * também é erro — `POST` sem sugestão nenhuma não tem efeito nenhum.
 *
 * Aceita tanto `{ "suggestions": [...] }` quanto uma sugestão solta
 * (`{ "text": "..." }`), para a interface poder registrar as duas coisas. Os
 * itens da lista podem ser `{ "text": "..." }` ou a string do texto direto —
 * a mesma tolerância de `readSuggestions`.
 *
 * @param body - Corpo já parseado da requisição.
 */
export function validateSuggestions(body: unknown): SuggestionValidation {
  if (typeof body !== 'object' || body === null) {
    return { ok: false, error: 'Corpo da requisição inválido' };
  }

  // `{ text: "..." }` — uma sugestão só.
  if (typeof (body as { text?: unknown }).text === 'string') {
    const single = toSuggestion(body);

    return single
      ? { ok: true, suggestions: [single] }
      : {
          ok: false,
          error: `text deve ter entre 1 e ${MAX_SUGGESTION_TEXT_LENGTH} caracteres`,
        };
  }

  const list = (body as { suggestions?: unknown }).suggestions;

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

  // O índice entra no erro porque a interface corrige o item, não a lista.
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
