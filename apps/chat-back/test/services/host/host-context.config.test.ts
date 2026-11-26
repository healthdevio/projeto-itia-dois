import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  DEFAULT_HOST_CONTEXT_LIMITS,
  DEFAULT_HOST_CONTEXT_TIMEOUT_MS,
  isHostContextEnabled,
  loadHostContextLimits,
  loadHostContextTimeoutMs,
} from '../../../src/services/host/host-context.config.js';

void describe('configuração do contexto do Host', () => {
  void it('usa os limites padrão quando o ambiente está vazio', () => {
    assert.deepEqual(loadHostContextLimits({}), DEFAULT_HOST_CONTEXT_LIMITS);
  });

  void it('lê os limites do ambiente', () => {
    const limits = loadHostContextLimits({
      HOST_CONTEXT_MAX_BYTES: '1024',
      HOST_CONTEXT_MAX_TOOLS: '10',
      HOST_CONTEXT_MAX_PERMISSIONS: '20',
      HOST_CONTEXT_MAX_TOOL_NAME: '30',
      HOST_CONTEXT_MAX_STRING: '40',
    });

    assert.deepEqual(limits, {
      maxPayloadBytes: 1024,
      maxTools: 10,
      maxPermissions: 20,
      maxToolNameLength: 30,
      maxStringLength: 40,
    });
  });

  void it('falha no boot quando um limite é inválido', () => {
    for (const value of ['0', '-1', '1.5', 'abc']) {
      assert.throws(
        () => loadHostContextLimits({ HOST_CONTEXT_MAX_TOOLS: value }),
        /HOST_CONTEXT_MAX_TOOLS/,
        value,
      );
    }
  });

  void it('lê o timeout e rejeita valor inválido', () => {
    assert.equal(loadHostContextTimeoutMs({}), DEFAULT_HOST_CONTEXT_TIMEOUT_MS);
    assert.equal(
      loadHostContextTimeoutMs({ HOST_CONTEXT_TIMEOUT_MS: '250' }),
      250,
    );
    assert.throws(
      () => loadHostContextTimeoutMs({ HOST_CONTEXT_TIMEOUT_MS: '0' }),
      /HOST_CONTEXT_TIMEOUT_MS/,
    );
  });

  void it('só habilita a integração com o valor explícito "1"', () => {
    assert.equal(isHostContextEnabled({}), false);
    assert.equal(isHostContextEnabled({ HOST_CONTEXT_ENABLED: 'true' }), false);
    assert.equal(isHostContextEnabled({ HOST_CONTEXT_ENABLED: '1' }), true);
  });
});
