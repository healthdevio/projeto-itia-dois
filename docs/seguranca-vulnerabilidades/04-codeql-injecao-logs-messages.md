# 04 - Alertas CodeQL de injeção em logs de mensagens

## Resumo

Registro da correção dos alertas **#1**, **#3** e **#4** do code scanning na
branch `fix/codeql-log-injection-messages-controller`, criada a partir de
`itia/develop` (`6f31f066`).

| Alerta | Classificação | Problema                                                                                                                             |
| ------ | ------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| #1     | High          | `Use of externally-controlled format string`: valor externo no primeiro argumento de `console.log`, onde `%s`/`%d` são interpretados |
| #3     | Medium        | `js/log-injection`: valores controlados pelo cliente entram em logs com `\r`/`\n`                                                    |
| #4     | Medium        | `js/log-injection`: mesmo padrão em outra linha do registro de mensagens                                                             |

O alerta **#2** (regex polinomial em `apps/chat-back/src/middleware/identity.ts`,
High) **não foi tratado**: é um risco de negação de serviço, de outra natureza,
e depende de tarefa separada.

## Causa

O registro `[Core] Mensagem recebida de ...` usava um template literal com
`message.origin`, `userId`, `message.message_id` e campos de configuração, todos
originados do corpo da requisição ou do token. Um `origin` contendo `\n` podia
encerrar a linha e forjar uma entrada falsa; um `%s` no primeiro argumento
podia alterar a formatação.

No branch analisado, esse registro está em
`apps/chat-back/src/services/message-processing/message-processing.service.ts`,
e não mais em `messages.controller.ts`: o controller já tinha quatro correções
parciais (`3ac54f8d`, `0551448f`, `13ca2b78`, `5cdb2f37`) e um helper privado que
só removia `\r`/`\n`. O código do branch foi tratado como fonte da verdade; os
pontos ainda inseguros do controller também foram ajustados.

## Correção

- `src/utils/sanitize-for-log.ts`: função pura `sanitizeForLog(value, maxLength =
200)`. Converte o valor sem lançar exceção (inclusive quando `toString` falha),
  troca caracteres de controle C0/C1, DEL, escape ANSI e separadores Unicode
  (`\u2028`/`\u2029`) por espaço, trunca com reticências e respeita `maxLength`.
  Nenhum erro de conversão (`toString`/`Symbol.toPrimitive`) interrompe o
  registro.
- `src/utils/message-log.ts`: `FORMATO_MENSAGEM_RECEBIDA` é uma constante
  literal com `%s`, e `registrarMensagemRecebida` passa todos os valores
  sanitizados como argumentos seguintes de `console.log`. O primeiro argumento
  nunca contém dado externo.
- `message-processing.service.ts`: passou a chamar `registrarMensagemRecebida`
  no lugar do template literal. O `Logger` foi removido deste serviço porque
  não interpreta `%s` e não era usado em outro ponto.
- `messages.controller.ts`: usa o helper compartilhado no lugar do método
  privado, e os dois `console.error` com template literal passaram a ter formato
  constante com `%s`.

A linha produzida para um `origin` normal permanece idêntica:

```text
[Core] Mensagem recebida de web (usuário user-1): msg-1 · config pt-BR · formal · short
```

`tenantId` não aparece nesse registro no branch atual; nenhum campo foi acrescentado.

## Decisões

- **Formato:** `console.log` com string literal e `%s`, padrão já usado no
  controller de mensagens. O `Logger` do Nest concatena argumentos e não
  interpreta `%s`, então não foi usado para esta linha.
- **Validação de `origin`:** não foi alterada. `messageSchema` define
  `z.string().trim().min(1)`, uma string livre, e o código/docs não declaram uma
  lista permitida; restringiria um contrato público. A sanitização no log é
  suficiente para os três alertas. Recomenda-se definir um enum/domínio em
  conjunto com o Back-end em tarefa separada.
- **Especificadores nos valores:** como `%s` aparece somente no argumento de
  formato, um `%s` dentro do valor é texto e não é interpretado.

## Como foi testado

- `test/utils/sanitize-for-log.test.ts`: quebras, tabulação, NUL, escape ANSI,
  DEL, separadores Unicode, todos os controles C0, truncamento, `maxLength`,
  `null`/`undefined`/número/booleano/símbolo/objeto, `toString` que lança e
  entradas incomuns.
- `test/utils/message-log.test.ts`: spy em `console.log` com `origin`
  `"web\n[Core] Mensagem recebida de admin (usuário x): %s"`; verifica **uma**
  chamada, primeiro argumento constante, nenhuma quebra/controle no registro,
  `%s` preservado como texto e linha equivalente para `origin` normal. Também
  cobre `userId`, `messageId` e configuração hostis.

Validações executadas: `npm run typecheck`, `npm run lint` (sem avisos),
`npm test` (262 testes, 0 falhas), `npm run build`, `npm run format:check` e
`git diff --check` — todas aprovadas.

## CodeQL

O CLI do CodeQL não estava disponível no PATH deste ambiente, então não foi
executado. A confirmação de que os
alertas #1/#3/#4 fecharam só virá do CI do GitHub depois que a correção chegar à
branch analisada e um novo scan rodar. Este documento **não** declara os alertas
como resolvidos.

Se o scan não reconhecer `sanitizeForLog` como sanitizador, a alternativa é
manter um `.replace(/[\r\n]/g, ' ')` em linha nos pontos dos alertas, além do
helper. Como o formato já é literal e os valores são argumentos, o risco de
`format string` não depende do reconhecimento do helper.

## Fora do escopo

- Alerta #2: regex polinomial em `src/middleware/identity.ts` (High, DoS).
- Outros pontos com valor externo em log, levantados e **não alterados**:
  - `controllers/conversations.controller.ts:27,51,68,77` — `userId` e `conversation.id`;
  - `controllers/suggestions.controller.ts:42,68,78,101` — `userId` e textos de sugestões;
  - `controllers/sse.controller.ts:69,74,123,128` e `services/sse/sse.service.ts:117,143,331` — `userId`/`connectionId`;
  - `services/host/host-context.service.ts:60,79`, `host-tool-catalog.service.ts:85`, `host-tool-execution.service.ts:314`;
  - `services/ai/providers/nvidia.ts:286,291`, `models/conversation-state.ts:45`.
