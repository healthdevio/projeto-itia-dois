# Task 01 — Criar o modelo Tool

## Objetivo

Definir a estrutura básica que representa uma ferramenta disponível para a
Omnia IA, com campos para identificá-la e descrever a capacidade oferecida.

## Modelo

O tipo está definido em `apps/chat-back/src/models/tool.ts`:

```ts
export interface Tool {
  name: string;
  description: string;
}
```

| Campo         | Tipo     | Descrição                                             |
| ------------- | -------- | ----------------------------------------------------- |
| `name`        | `string` | Identificador estável da ferramenta.                  |
| `description` | `string` | Descrição da capacidade oferecida pela ferramenta.    |

## Escopo desta task

Este modelo define apenas a identidade e a descrição da ferramenta. Ele não
inclui parâmetros, schema de entrada, validação, permissões nem lógica de
execução. Esses aspectos devem ser tratados nas tasks correspondentes, conforme
a integração com ferramentas evoluir.

## Exemplo

```ts
const tool: Tool = {
  name: 'buscar_cliente',
  description: 'Busca os dados de um cliente.',
};
```
