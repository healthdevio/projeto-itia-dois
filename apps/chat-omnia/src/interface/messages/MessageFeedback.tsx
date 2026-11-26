import { ThumbsDown, ThumbsUp } from 'lucide-react';

import type {
  FeedbackRating,
  MessageFeedbackState,
} from '../../hooks/useMessageFeedback';

interface MessageFeedbackProps {
  state: MessageFeedbackState;
  onSelect: (rating: FeedbackRating) => void;
}

/** Controles visuais de avaliação de uma resposta da IA. */
function MessageFeedback({ state, onSelect }: MessageFeedbackProps) {
  const isSubmitting = state.status === 'submitting';
  const isLocked = isSubmitting || state.status === 'submitted';

  const classeBotao = (selecionado: boolean) =>
    'inline-flex h-7 w-7 items-center justify-center rounded outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 ' +
    (selecionado
      ? 'bg-accent text-accent-foreground'
      : 'text-muted-foreground hover:bg-accent hover:text-foreground');

  return (
    <div className="mt-1 flex flex-wrap items-center gap-1">
      <button
        type="button"
        onClick={() => onSelect('positive')}
        disabled={isLocked}
        aria-label="Avaliar resposta como positiva"
        aria-pressed={state.rating === 'positive'}
        className={classeBotao(state.rating === 'positive')}
      >
        <ThumbsUp className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
      <button
        type="button"
        onClick={() => onSelect('negative')}
        disabled={isLocked}
        aria-label="Avaliar resposta como negativa"
        aria-pressed={state.rating === 'negative'}
        className={classeBotao(state.rating === 'negative')}
      >
        <ThumbsDown className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
      {isSubmitting ? (
        <span role="status" className="text-xs text-muted-foreground">
          Registrando avaliação...
        </span>
      ) : null}
      {state.status === 'submitted' ? (
        <span role="status" className="text-xs text-muted-foreground">
          Avaliação registrada.
        </span>
      ) : null}
      {state.status === 'error' && state.error ? (
        <p role="alert" className="w-full text-xs text-destructive">
          {state.error}
        </p>
      ) : null}
    </div>
  );
}

export default MessageFeedback;
