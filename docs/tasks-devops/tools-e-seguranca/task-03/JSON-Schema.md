# Task 03 — Definir JSON Schema das ferramentas

## Objetivo

Descrever os argumentos aceitos por cada ferramenta com JSON Schema e validar
os argumentos recebidos antes de uma futura execução.

## Schema no modelo Tool

O campo `input_schema` do modelo `Tool`, em
`apps/chat-back/src/models/tool.ts`, usa o tipo `Schema` exportado pelo Ajv.
Cada ferramenta pode definir quais propriedades são aceitas, seus tipos, quais
são obrigatórias e se propriedades adicionais são permitidas.

Exemplo de schema para uma ferramenta que busca um cliente:

```ts
input_schema: {
  type: 'object',
  properties: {
    customer_id: { type: 'string' },
  },
  required: ['customer_id'],
  additionalProperties: false,
}
```

## Validação dos argumentos

O validador está definido em
`apps/chat-back/src/services/tools/tool-arguments-validator.ts`. Ele compila o
schema da ferramenta com Ajv configurado para coletar todos os erros e verifica
se os argumentos fornecidos correspondem ao schema.

O resultado informa se os argumentos são válidos. Em caso de falha, retorna os
erros de validação do Ajv.

## Testes

Os testes estão em
`apps/chat-back/test/services/tools/tool-arguments-validator.test.ts`. Eles
verificam argumentos válidos e rejeitam argumentos sem campo obrigatório, com
tipo incorreto ou com propriedade adicional não permitida.

Para executar somente esses testes a partir de `apps/chat-back`:

```powershell
npx tsx --test test/services/tools/tool-arguments-validator.test.ts
```

## Escopo desta task

Esta task descreve e valida os argumentos de entrada. Ela não executa a
ferramenta, não verifica permissões e não integra chamadas de ferramentas ao
fluxo da IA. Esses comportamentos são tratados em tasks posteriores.
