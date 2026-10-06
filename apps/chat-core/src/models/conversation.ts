/**
 * Conversation Model
 *
 * Estrutura que a interface recebe do Core para montar a conversa atual.
 *
 * A conversa é de posse do Core: ela é persistida internamente (Postgres) e
 * NÃO é enviada para a AI. Apenas as mensagens são repassadas para a AI,
 * e cada envio carrega o contexto da conversa para que a IA tenha
 * consciência do histórico.
 *
 * Baseado na especificação em docs/core/Conversation.md
 */

import type { Message } from './message.js';

/**
 * Estados possíveis da conversa (máquina de estados do chat).
 *
 * `greeting`  Conversa recém-criada, sem interação do usuário. A interface
 *             mostra a mensagem de abertura (ex.: "Como posso ajudar?").
 * `idle`      Pronta para o usuário enviar uma nova mensagem.
 * `thinking`  Uma mensagem foi repassada para a AI e a resposta ainda não
 *             chegou. A interface mostra o indicador de carregamento.
 * `error`     A última operação falhou. A interface deve permitir retry.
 */
export const CONVERSATION_STATES = [
  'greeting',
  'idle',
  'thinking',
  'error',
] as const;

export type ConversationState = (typeof CONVERSATION_STATES)[number];

/**
 * Transições permitidas da máquina de estados.
 *
 * `null` como origem significa "qualquer estado" (estado inicial).
 * Um array vazio como destino significa estado terminal.
 */
const STATE_TRANSITIONS: Record<ConversationState, ConversationState[]> = {
  greeting: ['idle', 'error'],
  idle: ['thinking', 'greeting', 'error'],
  thinking: ['idle', 'error'],
  error: ['idle', 'greeting'],
};

/**
 * Verifica se a máquina de estados permite a transição de `from` para `to`.
 */
export function canTransition(
  from: ConversationState,
  to: ConversationState,
): boolean {
  if (from === to) return true;
  return STATE_TRANSITIONS[from].includes(to);
}

/**
 * Verifica se um valor é um estado de conversa válido.
 */
export function isConversationState(
  value: unknown,
): value is ConversationState {
  return (
    typeof value === 'string' &&
    (CONVERSATION_STATES as readonly string[]).includes(value)
  );
}

/**
 * Quem produziu a mensagem dentro da conversa.
 *
 * `user` Mensagem digitada pelo usuário na interface.
 * `assistant`  Resposta produzida pela AI.
 */
export type MessageRole = 'user' | 'assistant';

/**
 * Mensagem como aparece dentro de uma conversa.
 *
 * Estende o `Message` de entrada (docs/core/Message.md) com `role`, que
 * diferencia a mensagem do usuário da resposta da AI. O contrato de
 * entrada `POST /api/messages` permanece inalterado — `role` é atribuído
 * pelo Core ao persistir.
 */
export interface ConversationMessage extends Message {
  /** Discrimina mensagem do usuário e resposta da AI. */
  role: MessageRole;
}

/**
 * Uma conversa.
 *
 * Representa um diálogo entre o usuário e a AI. Existe exatamente uma
 * conversa `active` no Core; todas as demais formam o `history`.
 */
export interface Conversation {
  /** Identifica a conversa. */
  id: string;

  /** Estado atual da máquina de estados do chat. */
  state: ConversationState;

  /** Mensagens da conversa, em ordem cronológica. */
  messages: ConversationMessage[];

  /** Data de criação. ISO 8601 */
  created_at: string;

  /** Data da última alteração. ISO 8601 */
  updated_at: string;
}

/**
 * Conversa atual, do ponto de vista da interface.
 *
 * É o corpo de `GET /api/conversations/current`.
 *
 * `id`                atalho para `active_conversation.id`.
 * `state`             atalho para `active_conversation.state`.
 * `messages`          atalho para `active_conversation.messages`.
 * `active_conversation` a conversa em andamento.
 * `history`           conversas anteriores, mais recente primeiro.
 *
 * Os atalhos existem para que a interface renderize a tela sem precisar
 * navegar a estrutura aninhada; eles são cópias, não referências.
 */
export interface ConversationView {
  /** Atalho para `active_conversation.id`. */
  id: string;

  /** Atalho para `active_conversation.state`. */
  state: ConversationState;

  /** Atalho para `active_conversation.messages`. */
  messages: ConversationMessage[];

  /** Conversa em andamento. Sempre presente. */
  active_conversation: Conversation;

  /** Conversas anteriores, da mais recente para a mais antiga. */
  history: Conversation[];
}
