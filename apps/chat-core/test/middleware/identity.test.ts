import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  TENANT_ID_HEADER,
  USER_ID_HEADER,
  validateTenantId,
  validateUserId,
} from '../../src/middleware/identity.js';

describe('validateUserId', () => {
  it('aceita id opaco, email e subject de provedor de identidade', () => {
    for (const value of ['u_123', 'ana@exemplo.com', 'auth0|abc123']) {
      assert.equal(validateUserId(value), value, value);
    }
  });

  it('ignora espaço nas pontas', () => {
    assert.equal(validateUserId('  ana  '), 'ana');
  });

  it('recusa id vazio ou só com espaço', () => {
    for (const value of ['', '   ', undefined, null]) {
      assert.equal(validateUserId(value), null, String(value));
    }
  });

  it('recusa id com caractere fora do alfabeto aceito', () => {
    for (const value of ['ana maria', 'ana/maria', 'ana<script>', 'ana#1']) {
      assert.equal(validateUserId(value), null, value);
    }
  });

  it('recusa id acima do limite, para não virar chave de banco gigante', () => {
    assert.equal(validateUserId('a'.repeat(64)), 'a'.repeat(64));
    assert.equal(validateUserId('a'.repeat(65)), null);
  });

  it('recusa valor que não é string', () => {
    assert.equal(validateUserId(42 as unknown as string), null);
  });
});

describe('validateTenantId', () => {
  it('aceita id alfanumérico com ponto, hífen e sublinhado', () => {
    for (const value of ['acme', 'acme-1', 'acme_1', 'acme.br']) {
      assert.equal(validateTenantId(value), value, value);
    }
  });

  it('recusa tenant malformado em vez de derrubar a requisição', () => {
    // O tenant escolhe a persona, não concede acesso: um header estragado
    // significa "use o prompt padrão", nunca 401.
    for (const value of ['acme|1', 'acme/1', 'auth0|abc123', 'a b']) {
      assert.equal(validateTenantId(value), undefined, value);
    }
  });

  it('trata ausente e vazio como "sem tenant"', () => {
    assert.equal(validateTenantId(undefined), undefined);
    assert.equal(validateTenantId(''), undefined);
    assert.equal(validateTenantId('  '), undefined);
  });

  it('recusa tenant acima do limite', () => {
    assert.equal(validateTenantId('a'.repeat(64)), 'a'.repeat(64));
    assert.equal(validateTenantId('a'.repeat(65)), undefined);
  });
});

describe('nomes dos headers', () => {
  it('mantém o contrato de identidade documentado', () => {
    assert.equal(USER_ID_HEADER, 'X-User-Id');
    assert.equal(TENANT_ID_HEADER, 'X-Tenant-Id');
  });
});
