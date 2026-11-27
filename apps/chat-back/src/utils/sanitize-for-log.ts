/**
 * Sanitiza valores antes de registrá-los em log.
 *
 * Qualquer dado vindo de corpo, header, query ou token pode conter quebras de
 * linha, escapes ANSI ou especificadores de formato. A conversão para texto é
 * protegida: objetos sem `toString` utilizável não derrubam o processo.
 */

/** Controles C0/C1, DEL, escape ANSI e separadores de linha Unicode. */
// eslint-disable-next-line no-control-regex -- intencional: neutralizar controles antes de logar
const CARACTERES_PROBLEMATICOS = /[\u0000-\u001f\u007f-\u009f\u2028\u2029]/g;

const TAMANHO_PADRAO = 200;
const RETICENCIAS = '…';

export function sanitizeForLog(value: unknown, maxLength = 200): string {
  let texto: string;

  try {
    texto = typeof value === 'string' ? value : String(value);
  } catch {
    texto = '[valor não conversível]';
  }

  const semControle = texto.replace(CARACTERES_PROBLEMATICOS, ' ');
  const limite =
    Number.isFinite(maxLength) && maxLength >= 0
      ? Math.floor(maxLength)
      : TAMANHO_PADRAO;

  if (limite === 0) return '';
  if (semControle.length <= limite) return semControle;

  return (
    semControle.slice(0, limite - RETICENCIAS.length) + RETICENCIAS
  ).slice(0, limite);
}
