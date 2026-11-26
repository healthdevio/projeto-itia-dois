import { useCallback, useEffect, useRef, useState } from 'react';

import type { ChatDataSource } from '../transport/ChatDataSource';
import type { Conversation } from '../types/chat-contracts';

export type NewConversationStatus = 'idle' | 'starting' | 'error';

export interface NewConversationState {
  status: NewConversationStatus;
  error?: string;
  /** Devolve a Conversation apenas quando a operação tiver sido concluída. */
  startNewConversation: () => Promise<Conversation | null>;
}

const ERRO_GENERICO =
  'Não foi possível iniciar uma nova conversa. Tente novamente.';

/**
 * Controla a operação de nova conversa sem conhecer protocolo, autenticação ou
 * regras do núcleo. A conversa só é devolvida após a fonte de dados confirmar
 * a operação; falhas preservam o estado anterior da conversa.
 */
export function useNewConversation(
  source: ChatDataSource,
): NewConversationState {
  const [status, setStatus] = useState<NewConversationStatus>('idle');
  const emAndamento = useRef(false);
  const ativo = useRef(true);

  useEffect(() => {
    ativo.current = true;
    return () => {
      ativo.current = false;
    };
  }, []);

  const startNewConversation = useCallback(async () => {
    if (emAndamento.current) return null;

    emAndamento.current = true;
    if (ativo.current) setStatus('starting');

    try {
      const conversation = await source.startNewConversation();
      if (ativo.current) setStatus('idle');
      return conversation;
    } catch {
      if (ativo.current) setStatus('error');
      return null;
    } finally {
      emAndamento.current = false;
    }
  }, [source]);

  return {
    status,
    error: status === 'error' ? ERRO_GENERICO : undefined,
    startNewConversation,
  };
}
