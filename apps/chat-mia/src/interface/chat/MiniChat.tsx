import ChatHeader from '../components/ChatHeader';
import ChatInput from '../components/ChatInput';
import MessageList from '../messages/MessageList';

function MiniChat() {
  return (
    <section className="fixed bottom-20 right-4 flex h-96 w-80 flex-col overflow-hidden rounded-lg border bg-background shadow-lg">
      <ChatHeader />

      <MessageList />

      <ChatInput />
    </section>
  );
}

export default MiniChat;
