import type { Schema } from 'ajv';
import {
  CHAT_CONFIG_LANGUAGES,
  CHAT_CONFIG_RESPONSE_LENGTHS,
  CHAT_CONFIG_TONES,
  type ChatConfig,
} from '../../models/chat-config.js';
import type { ChatContext } from '../../models/chat-context.js';
import {
  HostIntegrationError,
  type HostConversationContext,
} from '../../models/host-integration.js';
import type { PermissionCode } from '../../models/permission.js';
import type { Tool } from '../../models/tool.js';
import {
  DEFAULT_HOST_CONTEXT_LIMITS,
  type HostContextLimits,
} from './host-context.config.js';

/** Profundidade máxima de objetos/arrays aceitos em campos livres. */
const MAX_JSON_DEPTH = 10;
const TOOL_NAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_.:-]*$/;
const PERMISSION_PATTERN =
  /^[A-Za-z0-9][A-Za-z0-9_.:-]*\.[A-Za-z0-9][A-Za-z0-9_.:-]*$/;
const RESERVED_KEYS = new Set(['__proto__', 'prototype', 'constructor']);

/**
 * O payload vem de fora do processo: a tipagem TypeScript não garante nada em
 * runtime. Por isso a resposta é validada e reconstruída campo a campo antes
 * de ser usada no prompt ou na autorização.
 */
export function parseHostConversationContext(
  value: unknown,
  limits: HostContextLimits = DEFAULT_HOST_CONTEXT_LIMITS,
): HostConversationContext {
  if (!isPlainObject(value)) {
    throw invalid('a resposta deve ser um objeto');
  }

  assertPayloadSize(value, limits);

  if (!isPlainObject(value.chat_context)) {
    throw invalid('chat_context deve ser um objeto');
  }
  if (!Array.isArray(value.tools)) {
    throw invalid('tools deve ser uma lista');
  }
  if (value.tools.length > limits.maxTools) {
    throw invalid(`tools excede o limite de ${limits.maxTools}`);
  }

  return {
    chat_context: parseChatContext(value.chat_context, limits),
    tools: parseTools(value.tools, limits),
  };
}

function invalid(reason: string): HostIntegrationError {
  return new HostIntegrationError(
    'unknown',
    `Contexto do Host inválido: ${reason}`,
  );
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function assertPayloadSize(
  value: Record<string, unknown>,
  limits: HostContextLimits,
): void {
  let serialized: string | undefined;
  try {
    serialized = JSON.stringify(value);
  } catch {
    throw invalid('não é serializável como JSON');
  }

  if (serialized === undefined) {
    throw invalid('não é serializável como JSON');
  }
  if (Buffer.byteLength(serialized, 'utf8') > limits.maxPayloadBytes) {
    throw invalid(`a resposta excede ${limits.maxPayloadBytes} bytes`);
  }
}

function parseChatContext(
  value: Record<string, unknown>,
  limits: HostContextLimits,
): ChatContext {
  const context: ChatContext = {};

  for (const field of ['user', 'profile', 'session'] as const) {
    const raw = value[field];
    if (raw === undefined) continue;

    const sanitized = sanitizeJsonValue(
      raw,
      limits,
      0,
      `chat_context.${field}`,
    );
    if (!isPlainObject(sanitized)) {
      throw invalid(`chat_context.${field} deve ser um objeto`);
    }
    context[field] = sanitized;
  }

  if (value.preferences !== undefined) {
    context.preferences = parsePreferences(value.preferences);
  }
  if (value.current_page !== undefined) {
    context.current_page = readString(
      value.current_page,
      'chat_context.current_page',
      limits,
    );
  }
  if (value.permissions !== undefined) {
    context.permissions = parsePermissions(
      value.permissions,
      'chat_context.permissions',
      limits,
    );
  }
  if (value.system_context !== undefined) {
    context.system_context = readString(
      value.system_context,
      'chat_context.system_context',
      limits,
    );
  }

  return context;
}

function parsePreferences(value: unknown): ChatConfig {
  if (!isPlainObject(value)) {
    throw invalid('chat_context.preferences deve ser um objeto');
  }

  const language = value.language;
  if (
    typeof language !== 'string' ||
    !(CHAT_CONFIG_LANGUAGES as readonly string[]).includes(language)
  ) {
    throw invalid('chat_context.preferences.language inválido');
  }

  const tone = value.tone;
  if (
    typeof tone !== 'string' ||
    !(CHAT_CONFIG_TONES as readonly string[]).includes(tone)
  ) {
    throw invalid('chat_context.preferences.tone inválido');
  }

  const responseLength = value.response_length;
  if (
    typeof responseLength !== 'string' ||
    !(CHAT_CONFIG_RESPONSE_LENGTHS as readonly string[]).includes(
      responseLength,
    )
  ) {
    throw invalid('chat_context.preferences.response_length inválido');
  }

  return {
    language: language as ChatConfig['language'],
    tone: tone as ChatConfig['tone'],
    response_length: responseLength as ChatConfig['response_length'],
  };
}

function parsePermissions(
  value: unknown,
  field: string,
  limits: HostContextLimits,
): PermissionCode[] {
  if (!Array.isArray(value)) {
    throw invalid(`${field} deve ser uma lista`);
  }
  if (value.length > limits.maxPermissions) {
    throw invalid(`${field} excede o limite de ${limits.maxPermissions}`);
  }

  const unique: PermissionCode[] = [];
  const seen = new Set<string>();

  for (const item of value) {
    if (typeof item !== 'string' || !PERMISSION_PATTERN.test(item)) {
      throw invalid(`${field} contém permissão inválida`);
    }
    if (!seen.has(item)) {
      seen.add(item);
      unique.push(item as PermissionCode);
    }
  }

  return unique;
}

function parseTools(value: unknown[], limits: HostContextLimits): Tool[] {
  const tools: Tool[] = [];
  const names = new Set<string>();

  for (const [index, item] of value.entries()) {
    const field = `tools[${index}]`;
    if (!isPlainObject(item)) {
      throw invalid(`${field} deve ser um objeto`);
    }

    const name = readToolName(item.name, `${field}.name`, limits);
    if (names.has(name)) {
      throw invalid(`${field}.name duplicado`);
    }
    names.add(name);

    const description = readString(
      item.description,
      `${field}.description`,
      limits,
    );
    const schema = sanitizeJsonValue(
      item.input_schema,
      limits,
      0,
      `${field}.input_schema`,
    );
    if (!isPlainObject(schema)) {
      throw invalid(`${field}.input_schema deve ser um objeto`);
    }

    tools.push({
      name,
      description,
      input_schema: schema as Schema,
      required_permissions: parsePermissions(
        item.required_permissions,
        `${field}.required_permissions`,
        limits,
      ),
    });
  }

  return tools;
}

function readToolName(
  value: unknown,
  field: string,
  limits: HostContextLimits,
): string {
  const name = readString(value, field, limits);
  if (!TOOL_NAME_PATTERN.test(name)) {
    throw invalid(`${field} tem formato inválido`);
  }
  if (name.length > limits.maxToolNameLength) {
    throw invalid(`${field} excede ${limits.maxToolNameLength} caracteres`);
  }
  return name;
}

function readString(
  value: unknown,
  field: string,
  limits: HostContextLimits,
): string {
  if (typeof value !== 'string') {
    throw invalid(`${field} deve ser texto`);
  }
  if (value.length > limits.maxStringLength) {
    throw invalid(`${field} excede ${limits.maxStringLength} caracteres`);
  }
  return value;
}

function sanitizeJsonValue(
  value: unknown,
  limits: HostContextLimits,
  depth: number,
  field: string,
): unknown {
  if (depth > MAX_JSON_DEPTH) {
    throw invalid(`${field} excede a profundidade máxima`);
  }
  if (value === null) return null;

  switch (typeof value) {
    case 'string':
      if (value.length > limits.maxStringLength) {
        throw invalid(`${field} excede ${limits.maxStringLength} caracteres`);
      }
      return value;
    case 'boolean':
      return value;
    case 'number':
      if (!Number.isFinite(value)) {
        throw invalid(`${field} contém número inválido`);
      }
      return value;
    case 'object': {
      if (Array.isArray(value)) {
        return value.map((item, index) =>
          sanitizeJsonValue(item, limits, depth + 1, `${field}[${index}]`),
        );
      }
      if (!isPlainObject(value)) {
        throw invalid(`${field} deve ser um objeto JSON`);
      }

      const sanitized: Record<string, unknown> = {};
      for (const [key, item] of Object.entries(value)) {
        if (RESERVED_KEYS.has(key)) {
          throw invalid(`${field} contém chave reservada`);
        }
        sanitized[key] = sanitizeJsonValue(
          item,
          limits,
          depth + 1,
          `${field}.${key}`,
        );
      }
      return sanitized;
    }
    default:
      throw invalid(`${field} contém valor que não é JSON`);
  }
}
