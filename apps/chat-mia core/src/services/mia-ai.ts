/**
 * Mia AI Service
 *
 * Serviço responsável por enviar mensagens para a Mia AI.
 *
 * A conversa **não** é repassada para a Mia AI. O Core guarda a conversa
 * internamente e, a cada nova mensagem, monta apenas o contexto que a IA
 * precisa para responder com consciência do histórico: as mensagens
 * anteriores da conversa ativa e um resumo das conversas anteriores.
 *
 * Isso mantém a Mia AI sem estado próprio: todo o histórico é reconstruído a
 * partir do armazenamento do Core no momento do envio.
 *
 * TODO: Implementar integração real com a Mia AI quando o endpoint estiver disponível.
 * Atualmente apenas simula o envio.
 */

import type { Message } from '../models/message.js';
import type {
  ConversationMessage,
  ConversationState,
} from '../models/conversation.js';

/**
 * Contexto da conversa repassado junto com a nova mensagem.
 *
 * Não é a conversa inteira: é afatia mínima que a Mia AI precisa para estar
 * ciente do contexto.
 */
export interface MiaAIContext {
  /** Id da conversa em que a mensagem foi enviada. */
  conversation_id: string;

  /** Estado da conversa no momento do envio. */
  state: ConversationState;

  /** Mensagens anteriores da conversa, em ordem cronológica. */
  previous_messages: ConversationMessage[];

  /** Ids das conversas anteriores, mais recente primeiro. */
  history_ids: string[];

  /**
   * Quantas mensagens anteriores são enviadas por padrão. O histórico completo
   * pode estourar o contexto da janela da IA em conversas longas.
   */
  max_context_messages: number;
}

/** Quantas mensagens anteriores vão por padrão no contexto. */
const DEFAULT_CONTEXT_WINDOW = 20;

/** Payload enviado à Mia AI. */
export interface MiaAIRequest {
  /** A mensagem nova do usuário. */
  message: Message;

  /** Contexto da conversa. */
  context: MiaAIContext;
}

/**
 * Monta o contexto a partir do estado atual da conversa.
 *
 * @param conversationId - Id da conversa ativa
 * @param state - Estado atual da máquina de estados
 * @param messages - Mensagens já persistidas na conversa ativa
 * @param historyIds - Ids das conversas anteriores, mais recente primeiro
 * @param maxContextMessages - Janela de contexto
 */
export function buildContext(
  conversationId: string,
  state: ConversationState,
  messages: ConversationMessage[],
  historyIds: string[],
  maxContextMessages = DEFAULT_CONTEXT_WINDOW,
): MiaAIContext {
  return {
    conversation_id: conversationId,
    state,
    // As `maxContextMessages` mais recentes bastam: as mais antigas já
    // saíram da janela e são as menos relevantes para a resposta atual.
    previous_messages: messages.slice(-maxContextMessages),
    history_ids: historyIds,
    max_context_messages: maxContextMessages,
  };
}

/**
 * Envia uma mensagem para a Mia AI junto com o contexto da conversa.
 *
 * @param request - Mensagem e contexto a enviar
 * @returns Resposta da Mia AI
 *
 * @future
 * - Implementar chamada HTTP para o endpoint da Mia AI
 * - Adicionar tratamento de erros e retries
 * - Implementar autenticação se necessário
 * - Adicionar timeout e circuit breaker
 */
export async function sendToMiaAI(
  request: MiaAIRequest,
): Promise<{ response: string }> {
  const { message, context } = request;

  console.log(
    `[Mia AI] Mensagem ${message.message_id} recebida para processamento ` +
      `(conversa ${context.conversation_id}, ${context.previous_messages.length} mensagens de contexto)`,
  );

  // TODO: Implementar chamada real para a Mia AI
  // O payload enviado contém a mensagem nova e o contexto — nunca a conversa
  // completa como objeto:
  // const response = await fetch(MIA_AI_ENDPOINT, {
  //   method: 'POST',
  //   headers: { 'Content-Type': 'application/json' },
  //   body: JSON.stringify(request),
  // });
  // return response.json();

  // Por enquanto, retorna uma simulação
  return {
    response: `[Mia AI] Mensagem ${message.message_id} recebida. Integração ainda não implementada.`,
  };
}
