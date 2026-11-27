import {
  IDLE_FEEDBACK,
  type FeedbackRating,
  type MessageFeedbackState,
} from '../../hooks/useMessageFeedback';
import MessageItem, { type ChatMessage } from './MessageItem';

interface MessageListProps {
  messages: ChatMessage[];
  feedbackStates: Record<string, MessageFeedbackState>;
  onFeedback: (messageId: string, rating: FeedbackRating) => void;
}

function MessageList({
  messages,
  feedbackStates,
  onFeedback,
}: MessageListProps) {
  return (
    <main className="flex-1 overflow-y-auto px-4 py-3">
      {messages.map((message) => {
        const isIA = message.author === 'omnia';
        const feedback = isIA
          ? (feedbackStates[message.message_id] ?? IDLE_FEEDBACK)
          : undefined;

        return (
          <MessageItem
            key={message.message_id}
            {...message}
            feedback={feedback}
            onFeedback={
              isIA
                ? (rating) => onFeedback(message.message_id, rating)
                : undefined
            }
          />
        );
      })}
    </main>
  );
}

export default MessageList;
