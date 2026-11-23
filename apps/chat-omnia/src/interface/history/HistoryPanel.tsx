import LoadingIndicator from '../components/LoadingIndicator';
import type { LoadedData } from '../../hooks/useChatData';
import type { Conversation } from '../../types/chat-contracts';
import HistoryItem from './HistoryItem';

interface HistoryPanelProps {
  data: LoadedData<Conversation>;
}

function HistoryPanel({ data }: HistoryPanelProps) {
  if (data.status === 'loading') {
    return (
      <aside
        aria-label="Carregando histórico"
        role="status"
        className="flex w-2/5 max-w-48 shrink-0 justify-center overflow-y-auto border-l p-3"
      >
        <LoadingIndicator />
      </aside>
    );
  }

  if (data.status === 'error') {
    return (
      <aside
        role="alert"
        className="w-2/5 max-w-48 shrink-0 overflow-y-auto border-l p-3"
      >
        <p className="text-xs text-destructive">
          Não foi possível carregar o histórico.
        </p>
      </aside>
    );
  }

  if (data.items.length === 0) return null;

  return (
    <aside
      aria-label="Histórico de conversas"
      className="w-2/5 max-w-48 shrink-0 overflow-y-auto border-l p-3"
    >
      <h3 className="mb-2 text-xs font-semibold">Histórico</h3>
      <ol className="flex flex-col gap-2">
        {data.items.map((conversation) => (
          <HistoryItem key={conversation.id} conversation={conversation} />
        ))}
      </ol>
    </aside>
  );
}

export default HistoryPanel;
