interface ChatHeaderProps {
  isExpanded: boolean;
  onToggleExpanded: () => void;
}

function ChatHeader({ isExpanded, onToggleExpanded }: ChatHeaderProps) {
  return (
    <header className="flex items-center justify-between border-b px-4 py-3">
      <h2 className="text-sm font-semibold">Chat Omnia</h2>
      <button
        type="button"
        onClick={onToggleExpanded}
        aria-label={isExpanded ? 'Minimizar chat' : 'Expandir chat'}
      >
        {isExpanded === false ? '+' : 'x'}
      </button>
    </header>
  );
}

export default ChatHeader;
