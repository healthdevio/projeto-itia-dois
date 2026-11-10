# Task 01 — Criar o modelo Tool

## Objetivo

Definir a estrutura básica que representa uma ferramenta disponível para a
Omnia IA, com campos para identificá-la e descrever a capacidade oferecida.

## Modelo

O tipo está definido em `apps/chat-back/src/models/tool.ts`:

```ts
import type { Schema } from 'ajv';
import type { PermissionCode } from './permission.js';

export interface Tool {
  name: string;
  description: string;
  input_schema: Schema;
  required_permissions: PermissionCode[];
}
```

| Campo                  | Tipo               | Descrição                                                |
| ---------------------- | ------------------ | -------------------------------------------------------- |
| `name`                 | `string`           | Identificador estável da ferramenta.                     |
| `description`          | `string`           | Descrição da capacidade oferecida pela ferramenta.       |
| `input_schema`         | `Schema`           | JSON Schema dos argumentos aceitos pela ferramenta.      |
| `required_permissions` | `PermissionCode[]` | Códigos de permissão necessários para usar a ferramenta. |

## Escopo desta task

O modelo descreve a identidade, a capacidade, o formato dos argumentos e as
permissões exigidas pela ferramenta. Ele não valida argumentos, concede ou
confere permissões nem executa a ferramenta. Esses comportamentos são tratados
nas tasks correspondentes.

## Exemplo

```ts
const tool: Tool = {
  name: 'buscar_cliente',
  description: 'Busca os dados de um cliente.',
  input_schema: {
    type: 'object',
    properties: {
      customer_id: { type: 'string' },
    },
    required: ['customer_id'],
    additionalProperties: false,
  },
  required_permissions: ['customer.read'],
};
```
