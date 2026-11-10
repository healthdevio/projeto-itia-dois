# Task 02 — Criar o modelo ToolCall

## Objetivo

Definir a estrutura de uma solicitação de execução de ferramenta, incluindo
identificação da chamada, nome da ferramenta, argumentos e contexto da conversa.

## Modelo

O tipo está definido em `apps/chat-back/src/models/tool-call.ts`:

```ts
export interface ToolCallContext {
  conversation_id: string;
}

export interface ToolCall {
  id: string;
  tool_name: string;
  arguments: Record<string, unknown>;
  context: ToolCallContext;
}
```

| Campo             | Tipo                      | Descrição                                                              |
| ----------------- | ------------------------- | ---------------------------------------------------------------------- |
| `id`              | `string`                  | Identificador que permite correlacionar a chamada.                     |
| `tool_name`       | `string`                  | Nome da ferramenta solicitada; corresponde ao `name` do modelo `Tool`. |
| `arguments`       | `Record<string, unknown>` | Argumentos fornecidos para a chamada.                                  |
| `context`         | `ToolCallContext`         | Contexto associado à solicitação.                                      |
| `conversation_id` | `string`                  | Identificador da conversa em que a chamada foi criada.                 |

## Exemplo

```ts
const toolCall: ToolCall = {
  id: 'call-123',
  tool_name: 'buscar_cliente',
  arguments: {
    customer_id: 'cliente-456',
  },
  context: {
    conversation_id: 'conversa-789',
  },
};
```

## Escopo desta task

O modelo descreve e correlaciona uma solicitação, mas não gera o identificador,
confere se a ferramenta existe, valida os argumentos, verifica permissões nem
executa a ferramenta. Esses comportamentos pertencem a etapas posteriores.
