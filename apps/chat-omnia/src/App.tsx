import { useState } from 'react';

import FloatingChatButton from './interface/chat/FloatingChatButton';
import MiniChat from './interface/chat/MiniChat';
import ExpandedChat from './interface/chat/ExpandedChat';
import type { MessageProps } from './interface/messages/MessageItem';

function App() {
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [messages, setMessages] = useState<MessageProps[]>([]);
  const [state] = useState<'greeting' | 'idle' | 'thinking' | 'error'>(
    'greeting',
  );

  const toggleChat = () => {
    setIsOpen(!isOpen);
  };

  const addMessage = (message: MessageProps) => {
    setMessages((currentMessages) => [
      ...currentMessages,
      message,
      { content: 'Mensagem recebida.', author: 'omnia' },
    ]);
  };

  const onToggleExpanded = () => {
    setIsExpanded(!isExpanded);
  };

  return (
    <div>
      {isOpen ? (
        isExpanded ? (
          <ExpandedChat
            isExpanded={isExpanded}
            onToggleExpanded={onToggleExpanded}
            messages={messages}
            onSendMessage={addMessage}
            state={state}
          />
        ) : (
          <MiniChat
            isExpanded={isExpanded}
            onToggleExpanded={onToggleExpanded}
            messages={messages}
            onSendMessage={addMessage}
            state={state}
          />
        )
      ) : null}
      <FloatingChatButton isOpen={isOpen} onClick={toggleChat} />
    </div>
  );
}

export default App;
