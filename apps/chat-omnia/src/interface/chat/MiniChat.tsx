import ChatHeader from '../components/ChatHeader';
import ChatInput from '../components/ChatInput';
import MessageList from '../messages/MessageList';
import type { MessageProps } from '../messages/MessageItem';
import ChatStateView from '../states/ChatStateView';
import SuggestionList from '../suggestions/SuggestionList';
import type { LoadedData } from '../../hooks/useChatData';
import type { Suggestion } from '../../types/chat-contracts';

interface MiniChatProps {
  isExpanded: boolean;
  onToggleExpanded: () => void;
  messages: MessageProps[];
  onSendMessage: (message: MessageProps) => void;
  state: 'greeting' | 'idle' | 'thinking' | 'error';
  suggestions: LoadedData<Suggestion>;
  onSelectSuggestion: (suggestion: Suggestion) => void;
}

function MiniChat({
  isExpanded,
  onToggleExpanded,
  messages,
  onSendMessage,
  state,
  suggestions,
  onSelectSuggestion,
}: MiniChatProps) {
  const handleSendMessage = (content: string) => {
    onSendMessage({ content, author: 'user' });
  };

  return (
    <section className="fixed bottom-20 right-4 flex h-96 w-80 flex-col overflow-hidden rounded-lg border bg-background shadow-lg">
      <ChatHeader isExpanded={isExpanded} onToggleExpanded={onToggleExpanded} />
      <ChatStateView state={state} />
      <MessageList messages={messages} />
      <SuggestionList data={suggestions} onSelect={onSelectSuggestion} />
      <ChatInput onSendMessage={handleSendMessage} />
    </section>
  );
}

export default MiniChat;
