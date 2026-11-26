import type { Conversation, Suggestion } from '../types/chat-contracts';

export interface ChatDataSource {
  getSuggestions(): Promise<Suggestion[]>;
  getHistory(): Promise<Conversation[]>;

  /**
   * Inicia uma nova conversa e devolve a Conversation retornada pelo Back-end.
   * A implementação REST deve chamar `POST /api/conversations/rotate`, sem
   * payload, e desembrulhar o envelope `ApiResponse<Conversation>`.
   */
  startNewConversation(): Promise<Conversation>;
}
