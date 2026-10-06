import { MessageCircle, X } from 'lucide-react';

interface FloatingChatButtonProps {
  isOpen: boolean;
  onClick: () => void;
}

function FloatingChatButton({ isOpen, onClick }: FloatingChatButtonProps) {
  return (
    <button
      className="fixed bottom-4 right-4 size-12 rounded-full hover:scale-105 transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2"
      aria-label={isOpen ? 'Fechar chat' : 'Abrir chat'}
      onClick={onClick}
    >
      {isOpen === true ? <X /> : <MessageCircle />}
    </button>
  );
}

export default FloatingChatButton;
