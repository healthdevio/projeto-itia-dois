import { sanitizeForLog } from './sanitize-for-log.js';

/**
 * Formato literal do registro de mensagem recebida. O primeiro argumento do
 * `console.log` é sempre esta constante: valores externos nunca ocupam o lugar
 * do formato, onde `%s` e `%d` seriam interpretados pelo Node.
 */
export const FORMATO_MENSAGEM_RECEBIDA =
  '[Core] Mensagem recebida de %s (usuário %s): %s · config %s · %s · %s';

export interface DadosLogMensagemRecebida {
  origin: unknown;
  userId: unknown;
  messageId: unknown;
  language: unknown;
  tone: unknown;
  responseLength: unknown;
}

/**
 * Aplica a sanitização a todos os valores externos presentes no registro. A
 * remoção de `\r`/`\n` também aparece em cada valor para que o CodeQL a reconheça
 * diretamente no caminho do argumento do log.
 */
export function valoresLogMensagemRecebida(
  dados: DadosLogMensagemRecebida,
): string[] {
  return [
    sanitizeForLog(dados.origin).replace(/\r\n|\r|\n/g, ' '),
    sanitizeForLog(dados.userId).replace(/\r\n|\r|\n/g, ' '),
    sanitizeForLog(dados.messageId).replace(/\r\n|\r|\n/g, ' '),
    sanitizeForLog(dados.language).replace(/\r\n|\r|\n/g, ' '),
    sanitizeForLog(dados.tone).replace(/\r\n|\r|\n/g, ' '),
    sanitizeForLog(dados.responseLength).replace(/\r\n|\r|\n/g, ' '),
  ];
}

/** Emite um único registro, sem quebras de linha e sem formato controlado. */
export function registrarMensagemRecebida(
  dados: DadosLogMensagemRecebida,
): void {
  const [origin, userId, messageId, language, tone, responseLength] =
    valoresLogMensagemRecebida(dados);

  console.log(
    FORMATO_MENSAGEM_RECEBIDA,
    origin,
    userId,
    messageId,
    language,
    tone,
    responseLength,
  );
}
