import type {
  FeedbackRating,
  MessageFeedbackState,
} from '../../hooks/useMessageFeedback';
import MessageFeedback from './MessageFeedback';

export interface MessageProps {
  content: string;
  author: 'user' | 'omnia';
}

/** Mensagem com identificador estável, usado como chave e para o feedback. */
export interface ChatMessage extends MessageProps {
  message_id: string;
}

interface MessageItemProps extends ChatMessage {
  feedback?: MessageFeedbackState;
  onFeedback?: (rating: FeedbackRating) => void;
}

function MessageItem({
  content,
  author,
  message_id,
  feedback,
  onFeedback,
}: MessageItemProps) {
  const isUser = author === 'user';
  const avaliavel = !isUser && Boolean(message_id) && feedback && onFeedback;

  return (
    <div className={'mb-2 flex ' + (isUser ? 'justify-end' : 'justify-start')}>
      <div className="max-w-[80%]">
        <div
          className={
            'rounded-lg px-3 py-2 text-sm ' +
            (isUser
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted text-foreground')
          }
        >
          {content}
        </div>
        {avaliavel && feedback && onFeedback ? (
          <MessageFeedback state={feedback} onSelect={onFeedback} />
        ) : null}
      </div>
    </div>
  );
}

export default MessageItem;
