import { useState } from 'react';

import FloatingChatButton from './interface/chat/FloatingChatButton';
import MiniChat from './interface/chat/MiniChat';
import ExpandedChat from './interface/chat/ExpandedChat';
import type { NewConversationControl } from './interface/components/ChatHeader';
import type { MessageProps } from './interface/messages/MessageItem';
import { useChatData } from './hooks/useChatData';
import { useNewConversation } from './hooks/useNewConversation';
import { mockChatDataSource } from './transport/mockChatDataSource';
import type {
  Conversation,
  ConversationState,
  Suggestion,
} from './types/chat-contracts';

type ChatViewState = 'greeting' | 'idle' | 'thinking' | 'error';

/** Tradução local dos estados do domínio para os estados visuais já existentes. */
function stateFromConversation(state: ConversationState): ChatViewState {
  switch (state) {
    case 'idle':
      return 'greeting';
    case 'streaming':
      return 'thinking';
    case 'success':
      return 'idle';
    case 'error':
      return 'error';
  }
}

function App() {
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [messages, setMessages] = useState<MessageProps[]>([]);
  const [state, setState] = useState<ChatViewState>('greeting');
  const [activeConversation, setActiveConversation] =
    useState<Conversation | null>(null);
  const chatData = useChatData(mockChatDataSource);
  const newConversation = useNewConversation(mockChatDataSource);

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

  const handleStartNewConversation = async () => {
    const conversation = await newConversation.startNewConversation();
    if (!conversation) return;

    setActiveConversation(conversation);
    setMessages([]);
    setState(stateFromConversation(conversation.state));
    void chatData.reloadHistory();
  };

  const newConversationControl: NewConversationControl = {
    onStart: () => {
      void handleStartNewConversation();
    },
    isStarting: newConversation.status === 'starting',
    error: newConversation.error,
  };

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
            key={activeConversation?.id ?? 'conversa-inicial'}
            isExpanded={isExpanded}
            onToggleExpanded={onToggleExpanded}
            messages={messages}
            onSendMessage={addMessage}
            state={state}
            suggestions={chatData.suggestions}
            onSelectSuggestion={handleSelectSuggestion}
            history={chatData.history}
            newConversation={newConversationControl}
          />
        ) : (
          <MiniChat
            key={activeConversation?.id ?? 'conversa-inicial'}
            isExpanded={isExpanded}
            onToggleExpanded={onToggleExpanded}
            messages={messages}
            onSendMessage={addMessage}
            state={state}
            suggestions={chatData.suggestions}
            onSelectSuggestion={handleSelectSuggestion}
            newConversation={newConversationControl}
          />
        )
      ) : null}
      <FloatingChatButton isOpen={isOpen} onClick={toggleChat} />
    </div>
  );
}

export default App;
