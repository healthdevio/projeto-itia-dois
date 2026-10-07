import LoadingIndicator from '../components/LoadingIndicator';

interface ChatStateViewProps {
  state: 'greeting' | 'idle' | 'thinking' | 'error';
}

function ChatStateView({ state }: ChatStateViewProps) {
  if (state === 'greeting') {
    return (
      <div className="flex flex-1 items-center justify-center px-4">
        <p className="text-center text-sm text-muted-foreground">
          Como posso ajudar?
        </p>
      </div>
    );
  }
  if (state === 'thinking') {
    return (
      <div className="flex flex-1 items-center justify-center px-4">
        <LoadingIndicator />
      </div>
    );
  }
  if (state === 'error') {
    return (
      <div className="flex flex-1 items-center justify-center px-4">
        <p className="text-center text-sm text-destructive">
          Não foi possível enviar sua mensagem. Tente novamente.
        </p>
      </div>
    );
  }

  return null;
}
export default ChatStateView;
