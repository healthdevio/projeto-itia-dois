import { useState } from 'react';

import FloatingChatButton from './interface/chat/FloatingChatButton';
import MiniChat from './interface/chat/MiniChat';
import ExpandedChat from './interface/chat/ExpandedChat';
import type { MessageProps } from './interface/messages/MessageItem';
import { useChatData } from './hooks/useChatData';
import { mockChatDataSource } from './transport/mockChatDataSource';
import type { Suggestion } from './types/chat-contracts';

function App() {
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [messages, setMessages] = useState<MessageProps[]>([]);
  const [state] = useState<'greeting' | 'idle' | 'thinking' | 'error'>(
    'greeting',
  );
  const chatData = useChatData(mockChatDataSource);

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

  /** Comportamento mínimo existente: o texto vai como mensagem local. */
  const handleSelectSuggestion = (suggestion: Suggestion) => {
    addMessage({ content: suggestion.text, author: 'user' });
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
            suggestions={chatData.suggestions}
            onSelectSuggestion={handleSelectSuggestion}
            history={chatData.history}
          />
        ) : (
          <MiniChat
            isExpanded={isExpanded}
            onToggleExpanded={onToggleExpanded}
            messages={messages}
            onSendMessage={addMessage}
            state={state}
            suggestions={chatData.suggestions}
            onSelectSuggestion={handleSelectSuggestion}
          />
        )
      ) : null}
      <FloatingChatButton isOpen={isOpen} onClick={toggleChat} />
    </div>
  );
}

export default App;
