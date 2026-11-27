import assert from 'node:assert/strict';
import { format } from 'node:util';
import { after, before, beforeEach, describe, it } from 'node:test';

import {
  FORMATO_MENSAGEM_RECEBIDA,
  registrarMensagemRecebida,
} from '../../src/utils/message-log.js';

void describe('registrarMensagemRecebida', () => {
  const consoleLogOriginal = console.log;
  let chamadas: unknown[][];

  before(() => {
    console.log = (...args: unknown[]) => {
      chamadas.push(args);
    };
  });

  after(() => {
    console.log = consoleLogOriginal;
  });

  beforeEach(() => {
    chamadas = [];
  });

  const dados = {
    userId: 'user-1',
    messageId: 'msg-1',
    language: 'pt-BR',
    tone: 'formal',
    responseLength: 'short',
  };

  void it('usa formato constante no primeiro argumento', () => {
    registrarMensagemRecebida({ ...dados, origin: 'web' });

    assert.equal(chamadas.length, 1);
    assert.equal(chamadas[0][0], FORMATO_MENSAGEM_RECEBIDA);
    assert.equal(typeof chamadas[0][0], 'string');
  });

  void it('não permite quebra de linha nem formato controlado pelo cliente', () => {
    const ataque = 'web\n[Core] Mensagem recebida de admin (usuário x): %s';
    registrarMensagemRecebida({ ...dados, origin: ataque });

    assert.equal(chamadas.length, 1);

    const linha = format(...chamadas[0]);
    // eslint-disable-next-line no-control-regex -- verifica a ausência de controles no registro
    assert.doesNotMatch(linha, /[\r\n]/);
    // eslint-disable-next-line no-control-regex -- verifica a ausência de separadores Unicode e escape ANSI
    assert.doesNotMatch(linha, /\u2028|\u2029|\u001b/);
    assert.match(linha, /Mensagem recebida de web \[Core\] Mensagem recebida/);
    assert.ok(linha.includes('%s'), '%s do cliente permanece como texto');
    assert.equal(
      linha,
      '[Core] Mensagem recebida de web [Core] Mensagem recebida de admin (usuário x): %s (usuário user-1): msg-1 · config pt-BR · formal · short',
    );
  });

  void it('sanitiza userId, messageId e configuração', () => {
    registrarMensagemRecebida({
      origin: 'web',
      userId: 'user\r\n1',
      messageId: 'msg\u2028-1',
      language: 'pt\u001b[31mBR',
      tone: 'formal%d',
      responseLength: 'short\t',
    });

    const linha = format(...chamadas[0]);
    // eslint-disable-next-line no-control-regex -- verifica a ausência de controles no registro
    assert.doesNotMatch(linha, /[\r\n\t\u2028\u001b]/);
    assert.match(
      linha,
      /formal%d/,
      'especificador no valor não é interpretado',
    );
  });

  void it('mantém a linha de um origin normal equivalente à anterior', () => {
    registrarMensagemRecebida({ ...dados, origin: 'web' });

    assert.equal(
      format(...chamadas[0]),
      '[Core] Mensagem recebida de web (usuário user-1): msg-1 · config pt-BR · formal · short',
    );
  });
});
