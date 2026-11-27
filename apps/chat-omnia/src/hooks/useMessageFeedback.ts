import { useCallback, useEffect, useRef, useState } from 'react';

export type FeedbackRating = 'positive' | 'negative';

export type FeedbackStatus =
  'idle' | 'selected' | 'submitting' | 'submitted' | 'error';

export interface MessageFeedbackState {
  status: FeedbackStatus;
  rating?: FeedbackRating;
  error?: string;
}

/**
 * Função injetada pela camada de transporte quando existir contrato de
 * feedback. Não há implementação nem rota definida nesta branch.
 */
export type SubmitMessageFeedback = (
  messageId: string,
  rating: FeedbackRating,
) => Promise<void>;

export const IDLE_FEEDBACK: MessageFeedbackState = { status: 'idle' };

const ERRO_GENERICO =
  'Não foi possível registrar sua avaliação. Tente novamente.';

/**
 * Estado de feedback isolado por identificador de mensagem. Nenhuma avaliação
 * é persistida localmente: sem uma função de envio injetada, a seleção fica
 * apenas no estado visual da tela.
 */
export function useMessageFeedback(submitFeedback?: SubmitMessageFeedback) {
  const [states, setStates] = useState<Record<string, MessageFeedbackState>>(
    {},
  );
  const estadosRef = useRef<Record<string, MessageFeedbackState>>({});
  const emAndamento = useRef<Set<string>>(new Set());
  const geracao = useRef(0);
  const ativo = useRef(true);

  useEffect(() => {
    ativo.current = true;
    return () => {
      ativo.current = false;
    };
  }, []);

  const definirEstado = useCallback(
    (messageId: string, state: MessageFeedbackState) => {
      estadosRef.current = { ...estadosRef.current, [messageId]: state };
      if (ativo.current) setStates(estadosRef.current);
    },
    [],
  );

  const select = useCallback(
    (messageId: string, rating: FeedbackRating) => {
      if (emAndamento.current.has(messageId)) return;

      const atual = estadosRef.current[messageId] ?? IDLE_FEEDBACK;
      if (atual.status === 'submitted') return;
      if (atual.status === 'selected' && atual.rating === rating) return;

      if (!submitFeedback) {
        definirEstado(messageId, { status: 'selected', rating });
        return;
      }

      emAndamento.current.add(messageId);
      const geracaoAtual = geracao.current;
      definirEstado(messageId, { status: 'submitting', rating });

      submitFeedback(messageId, rating)
        .then(() => {
          if (geracao.current === geracaoAtual) {
            definirEstado(messageId, { status: 'submitted', rating });
          }
        })
        .catch(() => {
          if (geracao.current === geracaoAtual) {
            definirEstado(messageId, {
              status: 'selected',
              rating,
              error: ERRO_GENERICO,
            });
          }
        })
        .finally(() => {
          emAndamento.current.delete(messageId);
        });
    },
    [definirEstado, submitFeedback],
  );

  const clear = useCallback(() => {
    geracao.current += 1;
    estadosRef.current = {};
    if (ativo.current) setStates({});
  }, []);

  return { states, select, clear };
}
