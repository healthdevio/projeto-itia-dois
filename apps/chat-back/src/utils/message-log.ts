import { sanitizeForLog } from './sanitize-for-log.js';

/**
 * Formato literal do registro de mensagem recebida. O primeiro argumento do
 * `console.log` é sempre esta constante: valores externos nunca ocupam o lugar
 * do formato, onde `%s` e `%d` seriam interpretados pelo Node.
 */
export const FORMATO_MENSAGEM_RECEBIDA = '[Core] Mensagem recebida: %s';

export interface DadosLogMensagemRecebida {
  origin: unknown;
  userId: unknown;
  messageId: unknown;
  language: unknown;
  tone: unknown;
  responseLength: unknown;
}

/**
 * Sanitiza os campos e serializa o objeto como um único argumento. JSON.stringify
 * escapa caracteres de controle e impede que valores externos forjem linhas.
 */
export function valoresLogMensagemRecebida(
  dados: DadosLogMensagemRecebida,
): string[] {
  return [
    JSON.stringify({
      origin: sanitizeForLog(dados.origin),
      userId: sanitizeForLog(dados.userId),
      messageId: sanitizeForLog(dados.messageId),
      language: sanitizeForLog(dados.language),
      tone: sanitizeForLog(dados.tone),
      responseLength: sanitizeForLog(dados.responseLength),
    }),
  ];
}

/** Emite um único registro, sem quebras de linha e sem formato controlado. */
export function registrarMensagemRecebida(
  dados: DadosLogMensagemRecebida,
): void {
  console.log(FORMATO_MENSAGEM_RECEBIDA, valoresLogMensagemRecebida(dados)[0]);
}
