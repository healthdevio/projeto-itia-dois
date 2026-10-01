import MessageItem, {type MessageProps} from "./MessageItem";

interface MessageListProps{
  messages: MessageProps[];
}

function MessageList({ messages }: MessageListProps) {
  return (
    <main className="flex-1 overflow-y-auto px-4 py-3">
      {messages.map((message) => (
        <MessageItem
          key={`${message.author}-${message.content}`}
          content={message.content}
          author={message.author}
        />
      ))}
    </main>
  );
}

export default MessageList;
