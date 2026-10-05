/**
 * Montagem de prompt a partir do contrato do Core.
 *
 * Traduz `{ message, context, config }` em mensagens de chat, usando o
 * `PromptTemplate` do tenant. É o único lugar onde o `config` que a interface
 * escolheu vira instrução de texto.
 *
 * Depende dos modelos do Core (`ChatConfig`, `PromptTemplate`) e devolve
 * `ChatMessage[]`. Nada de provider, modelo ou API: por isso o mesmo módulo
 * serve tanto para o substituto de teste quanto para a assistente de verdade.
 *
 * O texto vem do template, não daqui. Ver `../models/prompt-template.ts` para
 * o contrato e `prompts.ts` para a escolha por tenant.
 */

import type { ChatConfig } from '../../models/chat-config.js';
import type { ResolvedPromptTemplate } from '../../models/prompt-template.js';
import type { MiaAIContext } from './context.js';
import type { ChatMessage } from './provider.js';

/**
 * Monta o system prompt a partir do `config` e do template do tenant.
 *
 * Este é o ponto em que a configuração vira prompt. O Core entregou as
 * etiquetas; quem decide o que `formal` significa para o modelo é o template.
 *
 * @param config - Configuração efetiva do envio
 * @param template - Template do tenant, com os defaults já preenchidos
 * @param ignoreConfig - Quando `true`, o `config` é ignorado e a resposta sai
 *   no padrão. Existe para exercitar o caminho em que o provider ainda não sabe
 *   o que é `config` (ver `MIA_AI_IGNORE_CONFIG`).
 */
export function systemPrompt(
  config: ChatConfig,
  template: ResolvedPromptTemplate,
  ignoreConfig = false,
): string {
  if (ignoreConfig) return template.persona;

  return [
    template.persona,
    template.languageHints?.[config.language],
    template.toneHints?.[config.tone],
    template.lengthHints?.[config.response_length],
  ]
    .filter((hint): hint is string => typeof hint === 'string' && hint !== '')
    .join(' ');
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
 * @param template - Template do tenant, com os defaults já preenchidos
 * @param ignoreConfig - Repassa o `config` ao system prompt
 */
export function toChatMessages(
  message: string,
  context: MiaAIContext,
  config: ChatConfig,
  template: ResolvedPromptTemplate,
  ignoreConfig = false,
): ChatMessage[] {
  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt(config, template, ignoreConfig) },
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
 * Monta o prompt da chamada que pede as sugestões.
 *
 * @param reply - Resposta que acabou de ser dada
 * @param ask - Pergunta do usuário que a gerou
 * @param template - Template do tenant, com os defaults já preenchidos
 */
export function toSuggestionPrompt(
  reply: string,
  ask: string,
  template: ResolvedPromptTemplate,
): string {
  return [
    'Você acabou de responder a um paciente:',
    JSON.stringify(reply),
    '',
    `A pergunta dele foi: ${JSON.stringify(ask)}`,
    '',
    template.suggestions ?? '',
  ].join('\n');
}

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
