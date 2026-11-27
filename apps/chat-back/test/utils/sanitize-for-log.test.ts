import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { sanitizeForLog } from '../../src/utils/sanitize-for-log.js';

void describe('sanitizeForLog', () => {
  void it('substitui quebras de linha, tabulação, escape ANSI e NUL', () => {
    const entrada = 'web\r\n[Core] falso\t\u001b[31m\u0000fim';
    const resultado = sanitizeForLog(entrada);

    assert.equal(resultado, 'web [Core] falso  [31m fim');
    // eslint-disable-next-line no-control-regex -- verifica a remoção dos controles
    assert.doesNotMatch(resultado, /[\r\n\t\u0000\u001b]/);
  });

  void it('remove LF, CR e CRLF de forma global, com uma única substituição', () => {
    assert.equal(sanitizeForLog('a\nb'), 'a b');
    assert.equal(sanitizeForLog('a\rb'), 'a b');
    assert.equal(sanitizeForLog('a\r\nb'), 'a b');
    assert.equal(sanitizeForLog('a\r\nb\nc\rd'), 'a b c d');
    // eslint-disable-next-line no-control-regex -- verifica a remoção das quebras
    assert.doesNotMatch(sanitizeForLog('a\r\nb\nc\rd'), /[\r\n]/);
  });

  void it('substitui DEL e os separadores de linha Unicode', () => {
    const resultado = sanitizeForLog('a\u007fb\u2028c\u2029d\u0085e\u009ff');

    assert.equal(resultado, 'a b c d e f');
    // eslint-disable-next-line no-control-regex -- verifica a remoção dos controles
    assert.doesNotMatch(resultado, /[\u007f\u0085\u009f\u2028\u2029]/);
  });

  void it('remove todos os caracteres de controle C0', () => {
    const entrada = Array.from({ length: 32 }, (_, i) =>
      String.fromCharCode(i),
    );
    const resultado = sanitizeForLog(entrada.join(''));

    assert.equal(resultado.length, 32);
    // eslint-disable-next-line no-control-regex -- verifica a remoção dos controles
    assert.doesNotMatch(resultado, /[\u0000-\u001f]/);
  });

  void it('trunca valores longos e indica o truncamento', () => {
    const resultado = sanitizeForLog('a'.repeat(250));

    assert.equal(resultado.length, 200);
    assert.ok(resultado.endsWith('…'));
    assert.equal(resultado.slice(0, 199), 'a'.repeat(199));
  });

  void it('não reintroduz quebras de linha depois do truncamento', () => {
    const resultado = sanitizeForLog(`${'a'.repeat(199)}\n${'b'.repeat(20)}`);

    assert.equal(resultado.length, 200);
    assert.ok(resultado.endsWith('…'));
    // eslint-disable-next-line no-control-regex -- verifica a barreira após o truncamento
    assert.doesNotMatch(resultado, /[\r\n]/);
  });

  void it('respeita maxLength informado', () => {
    assert.equal(sanitizeForLog('abcdef', 4), 'abc…');
    assert.equal(sanitizeForLog('abc', 4), 'abc');
    assert.equal(sanitizeForLog('abc', 1), '…');
    assert.equal(sanitizeForLog('abc', 0), '');
  });

  void it('aceita null, undefined, número, booleano, símbolo e objeto', () => {
    assert.equal(sanitizeForLog(null), 'null');
    assert.equal(sanitizeForLog(undefined), 'undefined');
    assert.equal(sanitizeForLog(42), '42');
    assert.equal(sanitizeForLog(false), 'false');
    assert.equal(sanitizeForLog(Symbol('ok')), 'Symbol(ok)');
    assert.equal(sanitizeForLog({ origen: 'web' }), '[object Object]');
  });

  void it('não lança quando a conversão para string falha', () => {
    const hostil = {
      toString() {
        throw new Error('falha ao converter');
      },
    };
    const comSymbolHostil = {
      [Symbol.toPrimitive]() {
        throw new Error('falha ao converter');
      },
    };

    assert.doesNotThrow(() => sanitizeForLog(hostil));
    assert.equal(sanitizeForLog(hostil), '[valor não conversível]');
    assert.doesNotThrow(() => sanitizeForLog(comSymbolHostil));
    assert.equal(sanitizeForLog(comSymbolHostil), '[valor não conversível]');
  });

  void it('não lança para entradas incomuns', () => {
    const entradas: unknown[] = [
      Object.create(null),
      () => undefined,
      [1, 2],
      new Date(0),
      new Map([['a', 1]]),
    ];

    for (const entrada of entradas) {
      assert.doesNotThrow(() => sanitizeForLog(entrada));
    }
  });
});
