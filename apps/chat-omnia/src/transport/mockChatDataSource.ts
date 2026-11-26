import type { Conversation, Suggestion } from '../types/chat-contracts';
import type { ChatDataSource } from './ChatDataSource';

const suggestions: Suggestion[] = [
  { suggestion_id: 'sg-1', text: 'Ver meus detalhes' },
  { suggestion_id: 'sg-2', text: 'Falar com o suporte' },
  { suggestion_id: 'sg-3', text: 'Reagendar consulta' },
];

const history: Conversation[] = [
  {
    id: 'conversa-anterior-2',
    state: 'success',
    messages: [
      {
        message_id: 'msg-21',
        message: 'Olá, preciso de ajuda com meu pedido.',
        date: '2026-11-22T10:12:00.000Z',
        origin: 'frontend',
        role: 'user',
      },
      {
        message_id: 'msg-22',
        message: 'Claro. Qual é o número do pedido?',
        date: '2026-11-22T10:12:04.000Z',
        origin: 'ai',
        role: 'assistant',
      },
    ],
    created_at: '2026-11-22T10:12:00.000Z',
    updated_at: '2026-11-22T10:12:04.000Z',
  },
  {
    id: 'conversa-anterior-1',
    state: 'idle',
    messages: [
      {
        message_id: 'msg-11',
        message: 'Obrigado!',
        date: '2026-11-20T15:40:00.000Z',
        origin: 'frontend',
        role: 'user',
      },
    ],
    created_at: '2026-11-20T15:39:50.000Z',
    updated_at: '2026-11-20T15:40:00.000Z',
  },
];

let proximaConversaMock = 1;

export const mockChatDataSource: ChatDataSource = {
  async getSuggestions() {
    return suggestions.map((suggestion) => ({ ...suggestion }));
  },
  async getHistory() {
    return history.map((conversation) => ({
      ...conversation,
      messages: conversation.messages.map((message) => ({ ...message })),
    }));
  },
  async startNewConversation() {
    /**
     * SIMULAÇÃO LOCAL: este adaptador não conversa com o Back-end. O identificador
     * e os dados abaixo são apenas fixtures de teste — não representam uma
     * Conversation criada ou confirmada pelo servidor. A implementação REST
     * substitui este método por `POST /api/conversations/rotate`.
     */
    const agora = new Date().toISOString();
    return {
      id: `conversa-nova-mock-${proximaConversaMock++}`,
      state: 'idle',
      messages: [],
      created_at: agora,
      updated_at: agora,
    };
  },
};
