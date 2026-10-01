import ChatHeader from '../components/ChatHeader';
import ChatInput from '../components/ChatInput';
import MessageList from '../messages/MessageList';
import type { MessageProps } from '../messages/MessageItem';

interface ExpandedChatProps {
  isExpanded: boolean;
  onToggleExpanded: () => void;
  messages: MessageProps[];
  onSendMessage: (message: MessageProps) => void;
}

function ExpandedChat({
  isExpanded,
  onToggleExpanded,
  messages,
  onSendMessage,
}: ExpandedChatProps) {
  const handleSendMessage = (content: string) => {
    onSendMessage({
      content,
      author: 'user',
    });
  };
  return (
    <section className="flex h-[600px] flex-col overflow-hidden rounded-lg border bg-background shadow-lg">
      <ChatHeader isExpanded={isExpanded} onToggleExpanded={onToggleExpanded} />

      <MessageList messages={messages} />

      <ChatInput onSendMessage={handleSendMessage} />
    </section>
  );
}

export default ExpandedChat;
