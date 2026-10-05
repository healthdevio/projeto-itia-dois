/**
 * Erro de provider.
 *
 * Vira `502` no Core: o Core funcionou, mas o provider do qual ele depende não.
 * A causa original vem na mensagem, para que a interface possa oferecer retry
 * com sentido — chave inválida, limite de taxa e timeout são coisas diferentes
 * e o usuário não pode adivinhar qual é.
 */
export class MiaAIError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'MiaAIError';
  }
}
