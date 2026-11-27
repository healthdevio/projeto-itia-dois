# Task 05 — Definir estrutura de permissões

## Objetivo

Padronizar como as ferramentas declaram as permissões necessárias e como o
contexto representa as permissões disponíveis para a solicitação.

## Formato do código

`PermissionCode`, definido em `apps/chat-back/src/models/permission.ts`, usa o
formato `recurso.ação`. Exemplos:

```ts
const readCustomer: PermissionCode = 'customer.read';
const updateCustomer: PermissionCode = 'customer.update';
```

Esse tipo ajuda a manter o formato consistente durante o desenvolvimento, mas
TypeScript não valida valores em runtime. A validação de dados externos e as
decisões de autorização pertencem a tasks posteriores.

## Permissões exigidas pela ferramenta

O modelo `Tool`, em `apps/chat-back/src/models/tool.ts`, declara os códigos
necessários em `required_permissions`:

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

Uma lista vazia (`[]`) indica que a ferramenta não declara permissões
específicas. A Task 06 deverá definir como tratar esse caso e comparar as
permissões exigidas com as concedidas.

## Permissões disponíveis no contexto

O campo opcional `permissions` de `ChatContext`, em
`apps/chat-back/src/models/chat-context.ts`, usa `PermissionCode[]`. Ele
representa as permissões disponíveis no contexto; `required_permissions` no
modelo `Tool` representa as permissões exigidas para aquela ferramenta.

## Segurança e escopo

Os modelos ainda não estão conectados ao fluxo de chamadas. Declarar um código
não concede acesso nem faz uma verificação de autorização. Ao integrar o
contexto, o backend deve obter as permissões disponíveis de uma fonte confiável
(por exemplo, uma identidade verificada ou integração confiável com o Host), e
nunca confiar em valores enviados livremente pelo cliente ou gerados pela IA.

A Task 06 implementará a decisão de autorização e o bloqueio de chamadas sem as
permissões necessárias.
