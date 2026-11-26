import type { Conversation } from '../../types/chat-contracts';
import { formatDateTime } from '../../utils/formatDateTime';

interface HistoryItemProps {
  conversation: Conversation;
}

/** Um item do histórico: conversa anterior com as suas mensagens. */
function HistoryItem({ conversation }: HistoryItemProps) {
  const updatedAt = formatDateTime(conversation.updated_at);
  const createdAt = formatDateTime(conversation.created_at);
  const lastMessage = conversation.messages.at(-1);
  const count = conversation.messages.length;

  return (
    <li className="rounded-md border p-2 text-xs">
      <article aria-label="Conversa anterior">
        {updatedAt ? (
          <time dateTime={conversation.updated_at} className="font-medium">
            {updatedAt}
          </time>
        ) : (
          <span className="font-medium">Conversa anterior</span>
        )}
        <p className="mt-0.5 text-muted-foreground">
          {count} {count === 1 ? 'mensagem' : 'mensagens'}
        </p>
        {createdAt && createdAt !== updatedAt ? (
          <p className="text-muted-foreground">Iniciada em {createdAt}</p>
        ) : null}
        {lastMessage ? (
          <p className="mt-1 line-clamp-2 break-words">
            {lastMessage.role === 'user'
              ? 'Você: '
              : lastMessage.role === 'assistant'
                ? 'Omnia: '
                : ''}
            {lastMessage.message}
          </p>
        ) : null}
      </article>
    </li>
  );
}

export default HistoryItem;
