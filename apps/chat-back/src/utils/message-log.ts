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

/** Aplica a sanitização a todos os valores externos presentes no registro. */
export function valoresLogMensagemRecebida(
  dados: DadosLogMensagemRecebida,
): string[] {
  return [
    sanitizeForLog(dados.origin),
    sanitizeForLog(dados.userId),
    sanitizeForLog(dados.messageId),
    sanitizeForLog(dados.language),
    sanitizeForLog(dados.tone),
    sanitizeForLog(dados.responseLength),
  ];
}

/** Emite um único registro, sem quebras de linha e sem formato controlado. */
export function registrarMensagemRecebida(
  dados: DadosLogMensagemRecebida,
): void {
  console.log(FORMATO_MENSAGEM_RECEBIDA, ...valoresLogMensagemRecebida(dados));
}
