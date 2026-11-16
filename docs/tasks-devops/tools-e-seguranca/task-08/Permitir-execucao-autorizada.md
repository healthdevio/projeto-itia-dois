# Task 08 — Permitir execução autorizada

## Objetivo

Encaminhar ao executor somente chamadas autorizadas cujos argumentos passem na
validação definida pela ferramenta.

## Implementação

`executeToolCall`, em
`apps/chat-back/src/services/tools/tool-executor.ts`, segue esta ordem:

1. Verifica a autorização com `authorizeToolCall`.
2. Valida `toolCall.arguments` com `validateToolArguments`.
3. Chama o executor fornecido pelo chamador apenas quando as duas verificações
   passam.

Os resultados são discriminados pelo campo `success`:

- sucesso: `{ success: true, output }`;
- chamada não autorizada: `{ success: false, error: 'UNAUTHORIZED', missing }`;
- argumentos inválidos: `{ success: false, error: 'INVALID_ARGUMENTS', errors }`;
- falha lançada pelo executor: `{ success: false, error: 'EXECUTION_ERROR', reason }`.

O executor pode retornar um valor ou uma `Promise`. Exceções síncronas e
rejeições assíncronas do executor são convertidas para `EXECUTION_ERROR`.

## Testes

Os testes em `apps/chat-back/test/services/tools/tool-executor.test.ts` cobrem
execução autorizada, argumentos ausentes ou com tipo incorreto, exceção do
executor e a precedência da autorização quando tanto permissões quanto
argumentos são inválidos. Nos casos bloqueados, verificam também que o executor
não foi chamado.

Para executar os testes de ferramentas a partir de `apps/chat-back`:

```powershell
npm exec tsx -- --test test/services/tools/tool-executor.test.ts
```

## Limite da integração

Esta função fornece um ponto de controle que um fluxo de ferramentas pode
invocar. O backend ainda precisa integrar o executor concreto ao fluxo de
mensagens e fornecer o contexto de permissões confiável; esta task não conecta
por si só ferramentas a um provider de IA ou a uma integração Host.
