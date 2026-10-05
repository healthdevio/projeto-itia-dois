/**
 * Montagem de prompt a partir do contrato do Core.
 *
 * Traduz `{ message, context, config }` em mensagens de chat. É o único lugar
 * onde o `config` que a interface escolheu vira instrução de texto — e ele é
 * propositalmente genérico: um provider conversa com um modelo em formato de
 * chat, então este formato serve a todos eles.
 *
 * Depende só dos modelos do Core (`ChatConfig`, `MiaAIContext`) e devolve
 * `ChatMessage[]`. Nada de provider, modelo ou API: por isso o mesmo módulo
 * serve tanto para o substituto de teste quanto para a Mia AI de verdade.
 */

import type { ChatConfig } from '../../models/chat-config.js';
import type { MiaAIContext } from './context.js';
import type { ChatMessage } from './provider.js';

/** O que o provider sempre manda, independente do `config`. */
export const BASE_PROMPT = [
  'Você é a Mia AI, assistente de uma clínica de saúde.',
  'Você recebe o histórico da conversa em previous_messages; a última mensagem',
  'do usuário é a pergunta atual. Não invente dados do paciente.',
] as const;

/** Idioma pedido → instrução de idioma para o modelo. */
const LANGUAGE_HINT: Record<ChatConfig['language'], string> = {
  'pt-BR': 'Responda em português do Brasil.',
  'en-US': 'Reply in English.',
};

/** Tom pedido → instrução de tom para o modelo. */
const TONE_HINT: Record<ChatConfig['tone'], string> = {
  formal: 'Fale formalmente, tratando o paciente por você.',
  neutral: 'Fale de forma direta e natural.',
  informal: 'Fale de forma informal e simpática.',
};

/** Tamanho pedido → instrução de tamanho para o modelo. */
const LENGTH_HINT: Record<ChatConfig['response_length'], string> = {
  short: 'Responda em 1 a 2 frases.',
  standard: 'Responda em 2 a 4 frases.',
  detailed: 'Responda em 5 a 8 frases, com os detalhes que importam.',
};

/**
 * Monta o system prompt a partir do `config` que o Core repassou.
 *
 * Este é o ponto em que a configuração vira prompt. O Core entregou as
 * etiquetas; quem decide o que `formal` significa para o modelo é daqui.
 *
 * @param config - Configuração efetiva do envio
 * @param ignoreConfig - Quando `true`, o `config` é ignorado e a resposta sai
 *   no padrão. Existe para exercitar o caminho em que o provider ainda não sabe
 *   o que é `config` (ver `MIA_AI_IGNORE_CONFIG`).
 */
export function systemPrompt(config: ChatConfig, ignoreConfig = false): string {
  if (ignoreConfig) return BASE_PROMPT.join(' ');

  return [
    ...BASE_PROMPT,
    LANGUAGE_HINT[config.language],
    TONE_HINT[config.tone],
    LENGTH_HINT[config.response_length],
  ].join(' ');
}

/**
 * Transforma o contexto e a configuração do Core em mensagens de chat.
 *
 * O Core entrega as mensagens passadas, os ids das conversas anteriores e o
 * config da interface; quem decide como apresentá-los ao modelo é o provider.
 *
 * @param message - Texto da mensagem nova
 * @param context - Contexto montado pelo Core
 * @param config - Configuração efetiva do envio
 * @param ignoreConfig - Repassa o `config` ao system prompt
 */
export function toChatMessages(
  message: string,
  context: MiaAIContext,
  config: ChatConfig,
  ignoreConfig = false,
): ChatMessage[] {
  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt(config, ignoreConfig) },
  ];

  const history = context.history_ids.length;

  if (history > 0) {
    messages.push({
      role: 'system',
      content: `Este paciente já conversou com você ${history} vez(es) antes, em outras conversas. Não mencione isso se não for relevante.`,
    });
  }

  for (const previous of context.previous_messages) {
    if (typeof previous.message !== 'string') continue;

    messages.push({
      role: previous.role === 'mia' ? 'assistant' : 'user',
      content: previous.message,
    });
  }

  messages.push({ role: 'user', content: message });

  return messages;
}

/**
 * Pergunta ao modelo quais ações sugerir depois da resposta.
 *
 * O parse é tolerante de propósito: o modelo pode enrolar o JSON em ```json,
 * em prosa, ou devolver só o array. Se nada virar lista, o provider devolve
 * `null` — que é um sinal válido, e o Core preserva as sugestões anteriores em
 * vez de limpar.
 */
export const SUGGESTION_PROMPT = [
  'Sugira de 2 a 3 ações que ele poderia tomar a seguir, por exemplo',
  '"ver meu agendamento" ou "falar com a recepção".',
  'Responda APENAS com um array JSON de strings: nada de texto em volta,',
  'nada de markdown, nada de explicação.',
].join('\n');

/** Isola o primeiro array JSON de um texto, com ou sem ``` ao redor. */
export function extractJsonArray(text: string): unknown[] | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);

  for (const candidate of [fenced?.[1], text]) {
    if (!candidate) continue;

    const start = candidate.indexOf('[');
    const end = candidate.lastIndexOf(']');

    if (start === -1 || end <= start) continue;

    try {
      const parsed: unknown = JSON.parse(candidate.slice(start, end + 1));
      if (Array.isArray(parsed)) return parsed;
    } catch {
      // Não era JSON; tenta o próximo candidato.
    }
  }

  return null;
}

/** System prompt da chamada que devolve só as sugestões. */
export const SUGGESTION_SYSTEM_PROMPT = 'Você devolve somente JSON válido.';
