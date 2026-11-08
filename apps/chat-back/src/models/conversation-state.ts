export const CONVERSATION_STATES = [
  'idle',
  'streaming',
  'success',
  'error',
] as const;

export type ConversationState = (typeof CONVERSATION_STATES)[number];

const STATE_TRANSITIONS: Record<ConversationState, ConversationState[]> = {
  idle: ['streaming', 'error'],
  streaming: ['success', 'error'],
  success: ['streaming', 'error'],
  error: ['streaming', 'idle'],
};

export function canTransition(
  from: ConversationState,
  to: ConversationState,
): boolean {
  if (from === to) return true;
  return STATE_TRANSITIONS[from].includes(to);
}

export class InvalidStateTransitionError extends Error {
  constructor(
    readonly from: ConversationState,
    readonly to: ConversationState,
  ) {
    super(`Transição de estado inválida: ${from} → ${to}`);
    this.name = 'InvalidStateTransitionError';
  }
}

export function normalizeConversationState(value: unknown): ConversationState {
  if (isConversationState(value)) return value;
  if (value === 'greeting') return 'idle';
  if (value === 'thinking') return 'streaming';
  console.warn(`[Core] estado de conversa desconhecido: ${String(value)}`);
  return 'idle';
}

export function isConversationState(
  value: unknown,
): value is ConversationState {
  return (
    typeof value === 'string' &&
    (CONVERSATION_STATES as readonly string[]).includes(value)
  );
}
