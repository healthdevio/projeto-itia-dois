# Task 01 — Integração com Host: o que foi resolvido

**Data:** 23/11/2026
**Versão do contrato:** `1.0.0`
**Código:** `apps/chat-back/src/models/host-integration.ts`
**Task original:** [Definir contrato com o Sistema Host](../tasks-devops/integracao-com-host/task-01/Definir-contrato.md)
**Contrato detalhado:** [HostIntegration.md](HostIntegration.md)

> **Status:** o contrato, o adaptador de teste e as atualizações de
> `HostIntegration.md`/`Definir-contrato.md` foram feitos no working tree, mas
> **não fazem parte deste commit** (`fix/lint-ci-e-docs`). Devem ser commitados
> em uma alteração própria da Task 01.

## 1. Problema que a task resolve

Antes, o Core não tinha uma fronteira explícita para obter do Sistema Host o
contexto confiável da conversa, o catálogo de ferramentas e o resultado de uma
execução. Sem essa fronteira, a integração tenderia a se acoplar ao provider de
IA, ao transporte e à identidade enviada pelo navegador.

A revisão também encontrou uma divergência entre documentação e código:

| Onde   | Diziam                             | Realidade                                       |
| ------ | ---------------------------------- | ----------------------------------------------- |
| Docs   | `ToolCall.conversation_id` na raiz | O modelo usa `ToolCall.context.conversation_id` |
| Código | `ToolCall.context.conversation_id` | Correto                                         |

As duas documentações da task foram corrigidas para o formato real.

## 2. O que foi implementado

### 2.1 Contrato

O contrato é uma interface TypeScript interna, independente de provider e de
transporte. Ele define a fronteira entre o Core e um adaptador do Host:

```ts
interface HostIntegration {
  loadConversationContext(
    request: HostContextRequest,
  ): Promise<HostConversationContext>;

  executeTool(request: HostToolExecutionRequest): Promise<HostToolOutput>;
}
```

| Tipo / símbolo                      | Papel                                                                                                   |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `HOST_INTEGRATION_CONTRACT_VERSION` | Versão `1.0.0`; deve subir quando houver quebra de compatibilidade                                      |
| `HostPrincipal`                     | Identidade verificada (`user_id` e `tenant_id` opcional)                                                |
| `HostContextRequest`                | Principal + `conversation_id` + `signal` opcional                                                       |
| `HostConversationContext`           | `chat_context` + catálogo `tools` (pode ser vazio)                                                      |
| `HostToolExecutionRequest`          | Principal + `ToolCall` + `signal` opcional                                                              |
| `HostToolOutput`                    | Valor JSON recursivo (string, número, booleano, null, lista, objeto)                                    |
| `HostIntegrationError`              | Falha tipada com um dos 7 códigos do contrato                                                           |
| `HostErrorCode`                     | `unauthorized`, `forbidden`, `not_found`, `invalid_arguments`, `timeout`, `host_unavailable`, `unknown` |

Garantias registradas no contrato:

- A identidade vem do JWT OIDC validado pelo Core; o navegador nunca constrói
  `HostPrincipal`.
- `tool_call.id` é a chave de idempotência da execução.
- O Host revalida a autorização no instante da execução; grants do contexto não
  substituem essa checagem.
- Falha nunca resolve como sucesso vazio: sempre rejeita com
  `HostIntegrationError`.
- `AbortSignal` propaga cancelamento; cancelar não desfaz efeito já aplicado.

### 2.2 Adaptador em memória para testes

`apps/chat-back/test/helpers/host-integration.fake.ts` implementa o contrato sem
rede, banco ou NestJS. Ele existe **somente em `test/`** e não é registrado no
módulo da aplicação.

O fake permite configurar:

- contexto e catálogo de ferramentas;
- exigência de tenant (`forbidden` quando ausente);
- falha injetada (`HostIntegrationError`);
- saídas por nome de ferramenta;
- registro das chamadas realmente executadas (`executed_calls`), para provar que
  uma recusa não teve efeito colateral.

### 2.3 Testes de contrato

`apps/chat-back/test/models/host-integration.test.ts` cobre 8 cenários:

| Cenário                                                        | O que prova                                   |
| -------------------------------------------------------------- | --------------------------------------------- |
| Expõe uma versão do contrato                                   | Formato semver do contrato                    |
| Retorna contexto e ferramentas juntos                          | Carregamento básico e identidade encaminhada  |
| Aceita contexto vazio quando não há escopo                     | Contexto vazio não é erro                     |
| Recusa contexto quando o Host exige tenant ausente             | `forbidden` e falha fechada                   |
| Rejeita ferramenta inexistente com `not_found`                 | Erro tipado e nenhuma execução                |
| Recusa chamada sem grant com `forbidden`                       | Erro tipado e nenhuma execução                |
| Executa chamada autorizada e devolve JSON                      | Caminho feliz e preservação do `tool_call.id` |
| Propaga falha do Host como erro tipado, não como sucesso vazio | Falha de transporte não vira resposta vazia   |

## 3. O que ficou fora do escopo

O contrato foi desenhado para não fixar decisões que dependem do Host real:

- protocolo e transporte (HTTP, gRPC, fila, biblioteca local);
- autenticação serviço-a-serviço (mTLS, client credentials, HMAC);
- timeouts, tentativas e backoff;
- limites de tamanho de contexto e de saída;
- mapeamento do formato de erro do Host para os 7 códigos;
- obrigatoriedade do tenant;
- destino e retenção da auditoria;
- cache de contexto ou de catálogo.

Essas decisões estão detalhadas no relatório de decisões pendentes da integração.

## 4. Verificação

Executado em `apps/chat-back`:

| Verificação                              | Resultado |
| ---------------------------------------- | --------- |
| `npm test`                               | 122/122   |
| Testes de `host-integration`             | 8/8       |
| `npm run lint`                           | exit 0    |
| `npm run typecheck`                      | exit 0    |
| `npx tsc --noEmit -p tsconfig.test.json` | exit 0    |
| `npm run build`                          | exit 0    |

## 5. Próximos passos

1. Commitar o contrato, o fake e os testes em uma alteração própria da Task 01.
2. Responder às decisões de protocolo, autenticação e mapeamento de erro.
3. Implementar o adaptador real contra o Host usando o contrato já testado.
