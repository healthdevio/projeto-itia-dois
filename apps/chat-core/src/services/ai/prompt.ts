import type { ChatConfig } from '../../models/chat-config.js';
import type { ResolvedPromptTemplate } from '../../models/prompt-template.js';
import type { AIContext } from './context.js';
import type { ChatMessage } from './provider.js';
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
export function toChatMessages(
  message: string,
  context: AIContext,
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
      content: `Este usuário já conversou com você ${history} vez(es) antes, em outras conversas. Não mencione isso se não for relevante.`,
    });
  }
  for (const previous of context.previous_messages) {
    if (typeof previous.message !== 'string') continue;
    messages.push({
      role: previous.role === 'assistant' ? 'assistant' : 'user',
      content: previous.message,
    });
  }
  messages.push({ role: 'user', content: message });
  return messages;
}
export function toSuggestionPrompt(
  reply: string,
  ask: string,
  template: ResolvedPromptTemplate,
): string {
  return [
    'Você acabou de responder a um usuário:',
    JSON.stringify(reply),
    '',
    `A pergunta dele foi: ${JSON.stringify(ask)}`,
    '',
    template.suggestions ?? '',
  ].join('\n');
}
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
    } catch {}
  }
  return null;
}
