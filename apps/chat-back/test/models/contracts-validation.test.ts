import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  apiResponseSchema,
  createApiResponseSchema,
} from '../../src/models/api-response.js';
import {
  chatConfigInputSchema,
  chatConfigSchema,
} from '../../src/models/chat-config.js';
import { chatContextSchema } from '../../src/models/chat-context.js';
import { chatRequestSchema } from '../../src/models/chat-request.js';
import { chatResponseSchema } from '../../src/models/chat-response.js';
import {
  ContractValidationError,
  validateContract,
} from '../../src/models/contract-validation.js';
import {
  conversationSchema,
  conversationViewSchema,
} from '../../src/models/conversation.js';
import { messageSchema } from '../../src/models/message.js';
import { permissionCodeSchema } from '../../src/models/permission.js';
import { sseEventSchema } from '../../src/models/sse-events.js';
import {
  MAX_SUGGESTIONS,
  suggestionSchema,
  suggestionsListSchema,
} from '../../src/models/suggestion.js';

const validConfig = {
  language: 'pt-BR' as const,
  tone: 'neutral' as const,
  response_length: 'standard' as const,
};

const validSuggestion = {
  suggestion_id: 'sg-1',
  text: 'Resumir a conversa',
};

const validMessage = {
  message_id: 'msg-1',
  message: 'Olá, Omnia!',
  date: '2026-11-24T16:00:00.000Z',
  metadata: '{"source":"web"}',
  origin: 'web',
};

void describe('validateContract e ContractValidationError', () => {
  void it('retorna ok: true com os dados validados e normalizados (trim)', () => {
    const result = validateContract(
      messageSchema,
      {
        message_id: '  msg-1  ',
        message: '  Olá  ',
        origin: '  web  ',
      },
      'Message',
    );

    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.data.message_id, 'msg-1');
      assert.equal(result.data.message, 'Olá');
      assert.equal(result.data.origin, 'web');
    }
  });

  void it('retorna erros identificáveis com caminho e código quando o payload é inválido', () => {
    const result = validateContract(
      messageSchema,
      {
        message_id: '',
        message: '   ',
        origin: 'web',
      },
      'Message',
    );

    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.match(result.error, /Contrato Message inválido/);
      assert.ok(result.issues.some((issue) => issue.path === 'message_id'));
      assert.ok(result.issues.some((issue) => issue.path === 'message'));
    }
  });

  void it('cria ContractValidationError com nome do contrato e lista de issues', () => {
    const err = new ContractValidationError('ChatRequest', [
      {
        path: 'request_id',
        code: 'too_small',
        message: 'request_id é obrigatório',
      },
    ]);

    assert.equal(err.name, 'ContractValidationError');
    assert.equal(err.contractName, 'ChatRequest');
    assert.equal(err.issues.length, 1);
    assert.match(err.message, /Contrato ChatRequest inválido: request_id:/);
  });
});

void describe('Schemas de Message, Conversation e Suggestion', () => {
  void it('valida Conversation e ConversationView completos', () => {
    const conversation = {
      id: 'conv-1',
      state: 'idle' as const,
      messages: [{ ...validMessage, role: 'user' as const }],
      created_at: '2026-11-24T16:00:00.000Z',
      updated_at: '2026-11-24T16:01:00.000Z',
    };

    const convResult = validateContract(
      conversationSchema,
      conversation,
      'Conversation',
    );
    assert.equal(convResult.ok, true);

    const viewResult = validateContract(
      conversationViewSchema,
      {
        id: 'conv-1',
        state: 'idle',
        messages: conversation.messages,
        active_conversation: conversation,
        history: [conversation],
      },
      'ConversationView',
    );
    assert.equal(viewResult.ok, true);
  });

  void it('rejeita role inválido em ConversationMessage', () => {
    const result = validateContract(
      conversationSchema,
      {
        id: 'conv-1',
        state: 'idle',
        messages: [{ ...validMessage, role: 'system' }],
        created_at: '2026-11-24T16:00:00.000Z',
        updated_at: '2026-11-24T16:01:00.000Z',
      },
      'Conversation',
    );

    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.ok(
        result.issues.some((issue) => issue.path === 'messages.0.role'),
      );
    }
  });

  void it('valida Suggestion e respeita o limite máximo de sugestões', () => {
    assert.equal(
      validateContract(suggestionSchema, validSuggestion, 'Suggestion').ok,
      true,
    );

    const tooMany = Array.from({ length: MAX_SUGGESTIONS + 1 }, (_, idx) => ({
      suggestion_id: `sg-${idx}`,
      text: `Sugestão ${idx}`,
    }));
    const listResult = validateContract(
      suggestionsListSchema,
      tooMany,
      'SuggestionsList',
    );
    assert.equal(listResult.ok, false);
  });
});

void describe('Schemas de ChatConfig, PermissionCode e ChatContext', () => {
  void it('valida ChatConfig completo e ChatConfigInput parcial', () => {
    assert.equal(
      validateContract(chatConfigSchema, validConfig, 'ChatConfig').ok,
      true,
    );
    assert.equal(
      validateContract(
        chatConfigInputSchema,
        { tone: 'formal' },
        'ChatConfigInput',
      ).ok,
      true,
    );
    assert.equal(
      validateContract(chatConfigSchema, { language: 'es-ES' }, 'ChatConfig')
        .ok,
      false,
    );
  });

  void it('valida PermissionCode no formato recurso.acao e rejeita formatos inválidos', () => {
    assert.equal(
      validateContract(permissionCodeSchema, 'chat.read', 'PermissionCode').ok,
      true,
    );
    assert.equal(
      validateContract(permissionCodeSchema, 'chat.tools.run', 'PermissionCode')
        .ok,
      true,
    );
    assert.equal(
      validateContract(permissionCodeSchema, 'invalido', 'PermissionCode').ok,
      false,
    );
    assert.equal(
      validateContract(permissionCodeSchema, '.read', 'PermissionCode').ok,
      false,
    );
  });

  void it('valida ChatContext completo e rejeita permissions malformadas', () => {
    const okResult = validateContract(
      chatContextSchema,
      {
        user: { id: 'u-1' },
        preferences: validConfig,
        current_page: '/dashboard',
        permissions: ['chat.read', 'tools.execute'],
        system_context: 'Ambiente de testes',
      },
      'ChatContext',
    );
    assert.equal(okResult.ok, true);

    const failResult = validateContract(
      chatContextSchema,
      {
        permissions: ['sem_ponto'],
      },
      'ChatContext',
    );
    assert.equal(failResult.ok, false);
    if (!failResult.ok) {
      assert.ok(
        failResult.issues.some((issue) => issue.path === 'permissions.0'),
      );
    }
  });
});

void describe('Schemas de ChatRequest, ChatResponse, SSEEvent e ApiResponse', () => {
  void it('valida ChatRequest válido e rejeita ausência de request_id', () => {
    const okResult = validateContract(
      chatRequestSchema,
      {
        ...validMessage,
        request_id: 'req-1',
        conversation_id: 'conv-1',
        config: { language: 'en-US' },
      },
      'ChatRequest',
    );
    assert.equal(okResult.ok, true);

    const failResult = validateContract(
      chatRequestSchema,
      { ...validMessage },
      'ChatRequest',
    );
    assert.equal(failResult.ok, false);
    if (!failResult.ok) {
      assert.ok(failResult.issues.some((issue) => issue.path === 'request_id'));
    }
  });

  void it('valida ChatResponse válido e rejeita state desconhecido', () => {
    const okResult = validateContract(
      chatResponseSchema,
      {
        request_id: 'req-1',
        conversation_id: 'conv-1',
        message_id: 'msg-1',
        ai_response: 'Resposta da Omnia',
        state: 'success',
        suggestions: [validSuggestion],
        config: validConfig,
      },
      'ChatResponse',
    );
    assert.equal(okResult.ok, true);

    const failResult = validateContract(
      chatResponseSchema,
      {
        request_id: 'req-1',
        conversation_id: 'conv-1',
        message_id: 'msg-1',
        ai_response: 'Resposta',
        state: 'thinking',
        suggestions: [],
        config: validConfig,
      },
      'ChatResponse',
    );
    assert.equal(failResult.ok, false);
  });

  void it('valida os 4 tipos de SSEEvent e rejeita evento com state incompatível', () => {
    const validEvents = [
      {
        event: 'message.started',
        data: {
          request_id: 'req-1',
          conversation_id: 'conv-1',
          message_id: 'msg-1',
          state: 'streaming',
        },
      },
      {
        event: 'message.delta',
        data: {
          request_id: 'req-1',
          conversation_id: 'conv-1',
          message_id: 'msg-1',
          delta: 'Olá',
        },
      },
      {
        event: 'message.completed',
        data: {
          request_id: 'req-1',
          conversation_id: 'conv-1',
          message_id: 'msg-1',
          state: 'success',
          suggestions: [validSuggestion],
          config: validConfig,
        },
      },
      {
        event: 'message.error',
        data: {
          request_id: 'req-1',
          conversation_id: 'conv-1',
          message_id: 'msg-1',
          state: 'error',
          error: 'Falha temporária',
        },
      },
    ];

    for (const evt of validEvents) {
      assert.equal(
        validateContract(sseEventSchema, evt, 'SSEEvent').ok,
        true,
        evt.event,
      );
    }

    const mismatched = validateContract(
      sseEventSchema,
      {
        event: 'message.started',
        data: {
          request_id: 'req-1',
          conversation_id: 'conv-1',
          message_id: 'msg-1',
          state: 'success',
        },
      },
      'SSEEvent',
    );
    assert.equal(mismatched.ok, false);
  });

  void it('valida ApiResponse genérico e tipado', () => {
    assert.equal(
      validateContract(
        apiResponseSchema,
        { success: true, data: { ok: 1 } },
        'ApiResponse',
      ).ok,
      true,
    );

    const typedSchema = createApiResponseSchema(messageSchema);
    assert.equal(
      validateContract(
        typedSchema,
        { success: true, data: validMessage },
        'ApiResponse<Message>',
      ).ok,
      true,
    );
    assert.equal(
      validateContract(
        typedSchema,
        { success: true, data: { message_id: '' } },
        'ApiResponse<Message>',
      ).ok,
      false,
    );
  });
});
