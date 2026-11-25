import LoadingIndicator from '../components/LoadingIndicator';
import type { LoadedData } from '../../hooks/useChatData';
import type { Suggestion } from '../../types/chat-contracts';

interface SuggestionListProps {
  data: LoadedData<Suggestion>;
  onSelect: (suggestion: Suggestion) => void;
}

/**
 * Apresenta sugestões do Back-end. Não decide o que a sugestão faz: apenas
 * expõe `onSelect`. Texto do contrato é renderizado como texto, nunca HTML.
 */
function SuggestionList({ data, onSelect }: SuggestionListProps) {
  if (data.status === 'loading') {
    return (
      <section
        aria-label="Carregando sugestões"
        role="status"
        className="border-t px-3 py-2"
      >
        <LoadingIndicator />
      </section>
    );
  }

  if (data.status === 'error') {
    return (
      <section role="alert" className="border-t px-3 py-2">
        <p className="text-xs text-destructive">
          Não foi possível carregar as sugestões.
        </p>
      </section>
    );
  }

  if (data.items.length === 0) return null;

  return (
    <section
      aria-label="Sugestões"
      className="max-h-24 overflow-y-auto border-t px-3 py-2"
    >
      <ul className="flex flex-wrap gap-2">
        {data.items.map((suggestion) => (
          <li key={suggestion.suggestion_id}>
            <button
              type="button"
              onClick={() => onSelect(suggestion)}
              aria-label={`Enviar sugestão: ${suggestion.text}`}
              className="rounded-full border px-3 py-1 text-xs outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
            >
              {suggestion.text}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default SuggestionList;
