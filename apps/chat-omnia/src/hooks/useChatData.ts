import { useEffect, useState } from 'react';

import type { ChatDataSource } from '../transport/ChatDataSource';
import type { Conversation, Suggestion } from '../types/chat-contracts';

export type LoadStatus = 'loading' | 'ready' | 'error';

export interface LoadedData<T> {
  status: LoadStatus;
  items: T[];
  error?: string;
}

const INITIAL_SUGGESTIONS: LoadedData<Suggestion> = {
  status: 'loading',
  items: [],
};

const INITIAL_HISTORY: LoadedData<Conversation> = {
  status: 'loading',
  items: [],
};

export function useChatData(source: ChatDataSource) {
  const [suggestions, setSuggestions] =
    useState<LoadedData<Suggestion>>(INITIAL_SUGGESTIONS);
  const [history, setHistory] =
    useState<LoadedData<Conversation>>(INITIAL_HISTORY);

  useEffect(() => {
    let ativo = true;

    source
      .getSuggestions()
      .then((items) => {
        if (ativo) setSuggestions({ status: 'ready', items });
      })
      .catch(() => {
        if (ativo) {
          setSuggestions({
            status: 'error',
            items: [],
            error: 'Não foi possível carregar as sugestões.',
          });
        }
      });

    source
      .getHistory()
      .then((items) => {
        if (ativo) setHistory({ status: 'ready', items });
      })
      .catch(() => {
        if (ativo) {
          setHistory({
            status: 'error',
            items: [],
            error: 'Não foi possível carregar o histórico.',
          });
        }
      });

    return () => {
      ativo = false;
    };
  }, [source]);

  return { suggestions, history };
}
