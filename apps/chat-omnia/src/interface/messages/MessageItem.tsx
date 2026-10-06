export interface MessageProps {
  content: string;
  author: 'user' | 'omnia';
}

function MessageItem({ content, author }: MessageProps) {
  const isUser = author === 'user';

  return (
    <div className={'mb-2 flex ' + (isUser ? 'justify-end' : 'justify-start')}>
      <div
        className={
          'max-w-[80%] rounded-lg px-3 py-2 text-sm ' +
          (isUser
            ? 'bg-primary text-primary-foreground'
            : 'bg-muted text-foreground')
        }
      >
        {content}
      </div>
    </div>
  );
}

export default MessageItem;
