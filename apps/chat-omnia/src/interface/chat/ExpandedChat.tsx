import ChatHeader from '../components/ChatHeader';
import ChatInput from '../components/ChatInput';
import MessageList from '../messages/MessageList';
import type { MessageProps } from '../messages/MessageItem';
import ChatStateView from '../states/ChatStateView';

interface ExpandedChatProps {
  isExpanded: boolean;
  onToggleExpanded: () => void;
  messages: MessageProps[];
  onSendMessage: (message: MessageProps) => void;
  state: 'greeting' | 'idle' | 'thinking' | 'error';
}

function ExpandedChat({
  isExpanded,
  onToggleExpanded,
  messages,
  onSendMessage,
  state,
}: ExpandedChatProps) {
  const handleSendMessage = (content: string) => {
    onSendMessage({ content, author: 'user' });
  };

  return (
    <section className="fixed bottom-20 right-4 flex h-[calc(100vh-6rem)] max-h-[600px] w-[600px] flex-col overflow-hidden rounded-lg border bg-background shadow-lg">
      <ChatHeader isExpanded={isExpanded} onToggleExpanded={onToggleExpanded} />
      <ChatStateView state={state} />
      <MessageList messages={messages} />
      <ChatInput onSendMessage={handleSendMessage} />
    </section>
  );
}

export default ExpandedChat;
