import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  HostIntegrationError,
  type HostErrorCode,
} from '../../../src/models/host-integration.js';
import {
  hostErrorHttpStatus,
  hostErrorMessage,
} from '../../../src/services/host/host-error-response.js';

const cases: Array<[HostErrorCode, number, RegExp]> = [
  ['forbidden', 403, /negado/],
  ['timeout', 504, /Tempo esgotado/],
  ['unauthorized', 502, /não reconheceu/],
  ['host_unavailable', 502, /indisponível/],
  ['not_found', 502, /Não foi possível/],
  ['invalid_arguments', 502, /Não foi possível/],
  ['unknown', 502, /Não foi possível/],
];

void describe('resposta HTTP para falhas de contexto do Host', () => {
  for (const [code, status, message] of cases) {
    void it(`mapeia ${code} para ${status} sem expor detalhes`, () => {
      const error = new HostIntegrationError(code, 'detalhe interno do Host');

      assert.equal(hostErrorHttpStatus(error), status);
      assert.match(hostErrorMessage(error), message);
      assert.doesNotMatch(hostErrorMessage(error), /detalhe interno/);
    });
  }
});
