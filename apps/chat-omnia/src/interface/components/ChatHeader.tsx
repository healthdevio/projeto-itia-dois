export interface NewConversationControl {
  onStart: () => void;
  isStarting: boolean;
  error?: string;
}

interface ChatHeaderProps {
  isExpanded: boolean;
  onToggleExpanded: () => void;
  newConversation: NewConversationControl;
}

function ChatHeader({
  isExpanded,
  onToggleExpanded,
  newConversation,
}: ChatHeaderProps) {
  return (
    <header className="border-b">
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold">Chat Omnia</h2>
          <button
            type="button"
            onClick={newConversation.onStart}
            disabled={newConversation.isStarting}
            aria-label="Iniciar nova conversa"
            className="rounded border px-2 py-1 text-xs outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
          >
            {newConversation.isStarting ? 'Iniciando...' : 'Nova conversa'}
          </button>
        </div>
        <button
          type="button"
          onClick={onToggleExpanded}
          aria-label={isExpanded ? 'Minimizar chat' : 'Expandir chat'}
        >
          {isExpanded === false ? '+' : 'x'}
        </button>
      </div>
      {newConversation.error ? (
        <p role="alert" className="px-4 pb-3 text-xs text-destructive">
          {newConversation.error}
        </p>
      ) : null}
    </header>
  );
}

export default ChatHeader;
