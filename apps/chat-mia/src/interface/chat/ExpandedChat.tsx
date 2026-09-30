import ChatHeader from '../components/ChatHeader';
import ChatInput from '../components/ChatInput';
import MessageList from '../messages/MessageList';

interface ExpandedChatProps {
  isExpanded: boolean;
  onToggleExpanded: () => void;
}

function ExpandedChat({ isExpanded, onToggleExpanded }: ExpandedChatProps) {
  return (
    <section>
      <ChatHeader isExpanded={isExpanded} onToggleExpanded={onToggleExpanded} />

      <MessageList />

      <ChatInput />
    </section>
  );
}

export default ExpandedChat;
