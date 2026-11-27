import LoadingIndicator from '../components/LoadingIndicator';

interface ChatStateViewProps {
  state: 'greeting' | 'idle' | 'thinking' | 'error';
  /** Quantidade de mensagens já presentes no histórico da conversa. */
  mensagensCount: number;
}

function ChatStateView({ state, mensagensCount }: ChatStateViewProps) {
  const comHistorico = mensagensCount > 0;

  // O estado inicial existe apenas para a conversa vazia. Com mensagens, a
  // lista ocupa toda a área central; estados transitórios viram aviso compacto.
  if (state === 'greeting' && comHistorico) {
    return null;
  }
  if (state === 'idle') {
    return null;
  }

  const classes = comHistorico
    ? 'flex shrink-0 items-center justify-center px-4 py-2'
    : 'flex flex-1 items-center justify-center px-4';

  if (state === 'greeting') {
    return (
      <div className={classes}>
        <p className="text-center text-sm text-muted-foreground">
          Como posso ajudar?
        </p>
      </div>
    );
  }

  if (state === 'thinking') {
    return (
      <div className={classes}>
        <LoadingIndicator />
      </div>
    );
  }

  return (
    <div className={classes}>
      <p className="text-center text-sm text-destructive">
        Não foi possível enviar sua mensagem. Tente novamente.
      </p>
    </div>
  );
}

export default ChatStateView;
