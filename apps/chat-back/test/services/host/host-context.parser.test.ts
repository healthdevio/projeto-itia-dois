import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { HostIntegrationError } from '../../../src/models/host-integration.js';
import type { Tool } from '../../../src/models/tool.js';
import {
  DEFAULT_HOST_CONTEXT_LIMITS,
  type HostContextLimits,
} from '../../../src/services/host/host-context.config.js';
import { parseHostConversationContext } from '../../../src/services/host/host-context.parser.js';

const tool: Tool = {
  name: 'buscar_cliente',
  description: 'Busca os dados de um cliente.',
  required_permissions: ['customer.read'],
  input_schema: {
    type: 'object',
    properties: { customer_id: { type: 'string' } },
    required: ['customer_id'],
    additionalProperties: false,
  },
};

function payload(chat_context: unknown = {}, tools: unknown = []): unknown {
  return { chat_context, tools };
}

function rejectsInvalid(
  value: unknown,
  pattern: RegExp,
  limits: HostContextLimits = DEFAULT_HOST_CONTEXT_LIMITS,
): void {
  assert.throws(
    () => parseHostConversationContext(value, limits),
    (error: unknown) =>
      error instanceof HostIntegrationError &&
      error.code === 'unknown' &&
      pattern.test(error.message),
  );
}

void describe('parseHostConversationContext', () => {
  void it('aceita contexto e catálogo válidos', () => {
    const parsed = parseHostConversationContext(
      payload(
        {
          user: { display_name: 'Ana' },
          permissions: ['customer.read'],
        },
        [tool],
      ),
    );

    assert.deepEqual(parsed.chat_context, {
      user: { display_name: 'Ana' },
      permissions: ['customer.read'],
    });
    assert.equal(parsed.tools.length, 1);
    assert.equal(parsed.tools[0].name, 'buscar_cliente');
  });

  void it('aceita contexto vazio, que significa escopo sem dados', () => {
    assert.deepEqual(parseHostConversationContext(payload()), {
      chat_context: {},
      tools: [],
    });
  });

  void it('descarta campos que não fazem parte do contrato', () => {
    const parsed = parseHostConversationContext({
      chat_context: {
        current_page: '/clientes',
        campo_desconhecido: 'ignorado',
      },
      tools: [{ ...tool, extra: 'ignorado' }],
      extra_na_raiz: 'ignorado',
    });

    assert.deepEqual(parsed.chat_context, { current_page: '/clientes' });
    assert.deepEqual(Object.keys(parsed.tools[0]).sort(), [
      'description',
      'input_schema',
      'name',
      'required_permissions',
    ]);
  });

  void it('mantém campos livres como dados JSON e remove permissões duplicadas', () => {
    const parsed = parseHostConversationContext(
      payload({
        user: { display_name: 'Ana', metadata: { nivel: 2, ativo: true } },
        permissions: ['customer.read', 'customer.read', 'customer.write'],
      }),
    );

    assert.deepEqual(parsed.chat_context.user, {
      display_name: 'Ana',
      metadata: { nivel: 2, ativo: true },
    });
    assert.deepEqual(parsed.chat_context.permissions, [
      'customer.read',
      'customer.write',
    ]);
  });

  void it('valida preferências sem completar campos ausentes', () => {
    const parsed = parseHostConversationContext(
      payload({
        preferences: {
          language: 'pt-BR',
          tone: 'neutral',
          response_length: 'short',
        },
      }),
    );

    assert.deepEqual(parsed.chat_context.preferences, {
      language: 'pt-BR',
      tone: 'neutral',
      response_length: 'short',
    });

    rejectsInvalid(
      payload({ preferences: { language: 'pt-BR', tone: 'neutral' } }),
      /preferences\.response_length inválido/,
    );
    rejectsInvalid(
      payload({
        preferences: { language: 'pt-BR', tone: 'x', response_length: 'short' },
      }),
      /preferences\.tone inválido/,
    );
  });

  void it('rejeita resposta que não é objeto', () => {
    for (const value of [null, [], 'texto', 42]) {
      rejectsInvalid(value, /deve ser um objeto/);
    }
  });

  void it('rejeita estrutura obrigatória ausente', () => {
    rejectsInvalid({ tools: [] }, /chat_context/);
    rejectsInvalid(
      { chat_context: {}, tools: 'x' },
      /tools deve ser uma lista/,
    );
    rejectsInvalid({ chat_context: [], tools: [] }, /chat_context/);
  });

  void it('rejeita permissões fora do formato dominio.acao', () => {
    rejectsInvalid(
      payload({ permissions: ['sem_ponto'] }),
      /permissão inválida/,
    );
    rejectsInvalid(payload({ permissions: ['ok.'] }), /permissão inválida/);
    rejectsInvalid(
      payload({ permissions: ['ok.acao', 42] }),
      /permissão inválida/,
    );
  });

  void it('rejeita nomes de ferramenta inválidos ou duplicados', () => {
    rejectsInvalid(
      payload({}, [{ ...tool, name: '' }]),
      /tools\[0\]\.name tem formato inválido/,
    );
    rejectsInvalid(
      payload({}, [{ ...tool, name: 'com espaço' }]),
      /formato inválido/,
    );
    rejectsInvalid(payload({}, [tool, { ...tool }]), /duplicado/);
  });

  void it('rejeita schema de ferramenta que não é objeto', () => {
    rejectsInvalid(
      payload({}, [{ ...tool, input_schema: 'object' }]),
      /input_schema deve ser um objeto/,
    );
  });

  void it('rejeita valores que não são JSON', () => {
    rejectsInvalid(payload({ user: { callback: () => 'x' } }), /não é JSON/);
    rejectsInvalid(payload({ user: { valor: Number.NaN } }), /número inválido/);
    rejectsInvalid(
      payload({ user: { valor: Number.POSITIVE_INFINITY } }),
      /número inválido/,
    );
  });

  void it('rejeita chaves reservadas que poderiam poluir protótipos', () => {
    const hostile = JSON.parse(
      '{"chat_context":{"user":{"__proto__":{"admin":true}}},"tools":[]}',
    );

    rejectsInvalid(hostile, /chave reservada/);
  });

  void it('rejeita profundidade excessiva em campos livres', () => {
    let deep: unknown = 'fim';
    for (let index = 0; index < 12; index += 1) {
      deep = { proximo: deep };
    }

    rejectsInvalid(payload({ user: deep }), /profundidade máxima/);
  });

  void it('rejeita payload acima do limite de bytes', () => {
    rejectsInvalid(
      payload({ system_context: 'x'.repeat(500) }),
      /excede .* bytes/,
      { ...DEFAULT_HOST_CONTEXT_LIMITS, maxPayloadBytes: 100 },
    );
  });

  void it('rejeita excesso de ferramentas, permissões, textos e nomes', () => {
    const cases: Array<[HostContextLimits, unknown, RegExp]> = [
      [
        { ...DEFAULT_HOST_CONTEXT_LIMITS, maxTools: 1 },
        payload({}, [tool, { ...tool, name: 'outra' }]),
        /tools excede/,
      ],
      [
        { ...DEFAULT_HOST_CONTEXT_LIMITS, maxPermissions: 1 },
        payload({ permissions: ['a.b', 'c.d'] }),
        /permissions excede/,
      ],
      [
        { ...DEFAULT_HOST_CONTEXT_LIMITS, maxStringLength: 3 },
        payload({ current_page: '/longa' }),
        /current_page excede/,
      ],
      [
        { ...DEFAULT_HOST_CONTEXT_LIMITS, maxToolNameLength: 3 },
        payload({}, [{ ...tool, name: 'longa' }]),
        /name excede/,
      ],
    ];

    for (const [limits, value, pattern] of cases) {
      assert.throws(
        () => parseHostConversationContext(value, limits),
        (error: unknown) =>
          error instanceof HostIntegrationError && pattern.test(error.message),
      );
    }
  });
});
