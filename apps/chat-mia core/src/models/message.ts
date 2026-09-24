/**
 * Message Model
 * 
 * Representa a mensagem recebida da interface e enviada para o Core.
 * Baseado na especificação em docs/core/Message.md
 */

export interface Message {
  /** Identifica a mensagem. Obrigatório. */
  message_id: string;

  /** É o conteúdo da mensagem em si. Obrigatório. É o que o usuário digita. */
  message: string;

  /** Data de envio da mensagem. ISO 8601 */
  date?: string;

  /** Metadata sobre a mensagem */
  metadata?: string;

  /** Identifica a fonte da mensagem. Obrigatório. */
  origin: string;
}

/**
 * Resposta padrão da API
 */
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}
