# Task 07 — Bloquear ferramenta não autorizada

## Objetivo

Garantir que uma chamada sem as permissões necessárias seja interrompida antes
de alcançar o executor da ferramenta.

## Implementação

`executeToolCall`, em
`apps/chat-back/src/services/tools/tool-executor.ts`, recebe a ferramenta, a
chamada, o contexto confiável de permissões e um executor externo.

A autorização ocorre antes da validação dos argumentos e da execução. Se a
chamada não estiver autorizada, a função retorna `UNAUTHORIZED`, lista as
permissões faltantes e não chama o executor. Divergência entre o nome da
chamada e a ferramenta também é rejeitada com `UNAUTHORIZED` e motivo
`tool_mismatch`.

Uma ferramenta com `required_permissions: []` não exige permissões, mas seus
argumentos ainda precisam ser validados antes da execução.

## Confiança do contexto

O contexto com permissões é um argumento separado de `ToolCall`: o modelo atual
de chamada contém apenas o identificador da conversa. Essa separação impede
que permissões geradas pela IA ou fornecidas no corpo da chamada sejam
automaticamente tratadas como grants. O chamador deve fornecer permissões
obtidas de uma fonte confiável do backend.

## Testes

Os testes em `apps/chat-back/test/services/tools/tool-executor.test.ts` verificam
que chamadas sem permissões ou com permissões parciais retornam `UNAUTHORIZED`
sem invocar o executor. Também verificam que uma lista de permissões exigidas
vazia permite prosseguir para as etapas seguintes.

Para executar os testes de ferramentas a partir de `apps/chat-back`:

```powershell
npm exec tsx -- --test test/services/tools/tool-executor.test.ts
```
