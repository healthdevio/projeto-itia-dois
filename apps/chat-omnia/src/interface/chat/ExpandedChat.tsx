import ChatHeader, {
  type NewConversationControl,
} from '../components/ChatHeader';
import ChatInput from '../components/ChatInput';
import HistoryPanel from '../history/HistoryPanel';
import MessageList from '../messages/MessageList';
import type { ChatMessage, MessageProps } from '../messages/MessageItem';
import ChatStateView from '../states/ChatStateView';
import SuggestionList from '../suggestions/SuggestionList';
import type { LoadedData } from '../../hooks/useChatData';
import type {
  FeedbackRating,
  MessageFeedbackState,
} from '../../hooks/useMessageFeedback';
import type { Conversation, Suggestion } from '../../types/chat-contracts';

interface ExpandedChatProps {
  isExpanded: boolean;
  onToggleExpanded: () => void;
  messages: ChatMessage[];
  onSendMessage: (message: MessageProps) => void;
  state: 'greeting' | 'idle' | 'thinking' | 'error';
  suggestions: LoadedData<Suggestion>;
  onSelectSuggestion: (suggestion: Suggestion) => void;
  history: LoadedData<Conversation>;
  newConversation: NewConversationControl;
  feedbackStates: Record<string, MessageFeedbackState>;
  onFeedback: (messageId: string, rating: FeedbackRating) => void;
}

function ExpandedChat({
  isExpanded,
  onToggleExpanded,
  messages,
  onSendMessage,
  state,
  suggestions,
  onSelectSuggestion,
  history,
  newConversation,
  feedbackStates,
  onFeedback,
}: ExpandedChatProps) {
  const handleSendMessage = (content: string) => {
    onSendMessage({ content, author: 'user' });
  };

  return (
    <section className="fixed bottom-20 right-4 flex h-[calc(100vh-6rem)] max-h-[600px] w-[600px] flex-col overflow-hidden rounded-lg border bg-background shadow-lg">
      <ChatHeader
        isExpanded={isExpanded}
        onToggleExpanded={onToggleExpanded}
        newConversation={newConversation}
      />
      <ChatStateView state={state} />
      <div className="flex min-h-0 flex-1">
        <MessageList
          messages={messages}
          feedbackStates={feedbackStates}
          onFeedback={onFeedback}
        />
        <HistoryPanel data={history} />
      </div>
      <SuggestionList data={suggestions} onSelect={onSelectSuggestion} />
      <ChatInput onSendMessage={handleSendMessage} />
    </section>
  );
}

export default ExpandedChat;
