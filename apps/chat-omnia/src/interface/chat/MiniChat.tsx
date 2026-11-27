import ChatHeader, {
  type NewConversationControl,
} from '../components/ChatHeader';
import ChatInput from '../components/ChatInput';
import MessageList from '../messages/MessageList';
import type { ChatMessage, MessageProps } from '../messages/MessageItem';
import ChatStateView from '../states/ChatStateView';
import SuggestionList from '../suggestions/SuggestionList';
import type { LoadedData } from '../../hooks/useChatData';
import type {
  FeedbackRating,
  MessageFeedbackState,
} from '../../hooks/useMessageFeedback';
import type { Suggestion } from '../../types/chat-contracts';

interface MiniChatProps {
  isExpanded: boolean;
  onToggleExpanded: () => void;
  messages: ChatMessage[];
  onSendMessage: (message: MessageProps) => void;
  state: 'greeting' | 'idle' | 'thinking' | 'error';
  suggestions: LoadedData<Suggestion>;
  onSelectSuggestion: (suggestion: Suggestion) => void;
  newConversation: NewConversationControl;
  feedbackStates: Record<string, MessageFeedbackState>;
  onFeedback: (messageId: string, rating: FeedbackRating) => void;
}

function MiniChat({
  isExpanded,
  onToggleExpanded,
  messages,
  onSendMessage,
  state,
  suggestions,
  onSelectSuggestion,
  newConversation,
  feedbackStates,
  onFeedback,
}: MiniChatProps) {
  const handleSendMessage = (content: string) => {
    onSendMessage({ content, author: 'user' });
  };

  return (
    <section className="fixed bottom-20 right-4 flex h-96 w-80 flex-col overflow-hidden rounded-lg border bg-background shadow-lg">
      <ChatHeader
        isExpanded={isExpanded}
        onToggleExpanded={onToggleExpanded}
        newConversation={newConversation}
      />
      <ChatStateView state={state} mensagensCount={messages.length} />
      <MessageList
        messages={messages}
        feedbackStates={feedbackStates}
        onFeedback={onFeedback}
      />
      <SuggestionList data={suggestions} onSelect={onSelectSuggestion} />
      <ChatInput onSendMessage={handleSendMessage} />
    </section>
  );
}

export default MiniChat;
