# Segurança — Task 01: Sanitização global de logs

## Objetivo

Evitar que valores dinâmicos vindos de requisições, identidade, respostas do
Host ou processamento de mensagens forjem linhas de log e reduzir a dependência
do CodeQL reconhecer uma função local de sanitização como barreira de taint.

## Contexto

O registro anterior em
[`04-codeql-injecao-logs-messages.md`](../../../seguranca-vulnerabilidades/04-codeql-injecao-logs-messages.md)
descreve alertas `js/log-injection` em logs de mensagens e registra outros
pontos que ainda continham valores dinâmicos. A correção atual trata esses
pontos com o helper compartilhado `sanitizeForLog` e serialização JSON no
argumento que chega ao logger.

O helper existente em `apps/chat-back/src/utils/sanitize-for-log.ts` converte
valores com proteção contra conversões que lançam exceção, substitui controles
C0/C1, DEL, escapes ANSI e separadores Unicode, e limita o tamanho do texto. A
serialização JSON dos campos já sanitizados escapa caracteres especiais no
payload do registro. O helper central não precisou ser alterado nesta task.

## Resultado entregue

- `message-log.ts` consolida `origin`, `userId`, `messageId`, `language`,
  `tone` e `responseLength` em um único objeto JSON. O formato do log continua
  sendo constante e não há `spread` de argumentos dinâmicos.
- `messages.controller.ts` registra metadados e detalhes de validação/cancelamento
  como um payload JSON; removidas as substituições duplicadas de CR/LF nos
  pontos de log.
- Logs de conversas e sugestões serializam identidade, identificadores,
  sugestões e erros depois de sanitizá-los.
- Logs do controlador e serviço SSE serializam identidade, conexão,
  identificadores de mensagem e falhas.
- Logs de contexto/catálogo do Host, processamento NVIDIA, memória, validação de
  eventos SSE, estado desconhecido e filtro de exceções passaram a sanitizar e
  serializar valores dinâmicos.
- `test/utils/message-log.test.ts` foi ajustado para verificar o payload único
  em JSON e os valores sanitizados.

## Arquivos envolvidos

Código alterado em `apps/chat-back/src/`:

- `common/filters/api-exception.filter.ts`
- `controllers/conversations.controller.ts`
- `controllers/messages.controller.ts`
- `controllers/sse.controller.ts`
- `controllers/suggestions.controller.ts`
- `models/conversation-state.ts`
- `services/ai/memory.ts`
- `services/ai/providers/nvidia.ts`
- `services/host/host-context.service.ts`
- `services/host/host-tool-catalog.service.ts`
- `services/sse-event-validator.service.ts`
- `services/sse/sse.service.ts`
- `utils/message-log.ts`

Também foi atualizado `apps/chat-back/test/utils/message-log.test.ts`.

## Validação local

- `npm run typecheck` — passou.
- `npm run lint` — passou sem findings.
- `git diff --check` — passou.
- A suíte de testes não foi executada nesta task. As expectativas do teste
  unitário de `message-log` foram atualizadas, mas ainda precisam ser executadas.

## CodeQL e limites

O código local foi alterado para serializar os campos dinâmicos com
`JSON.stringify`, mantendo `sanitizeForLog` como sanitização central. Não foi
executado um scan do CodeQL neste ambiente. Portanto, os alertas mencionados
como **#26–#29** na solicitação ainda não podem ser declarados fechados; a
confirmação depende de um novo scan do GitHub depois que as alterações chegarem
à branch analisada.

A varredura dos logs em `apps/` também encontrou chamadas de diagnóstico em
`apps/packages/knowledge/`. Não foram alteradas: são scripts de teste/diagnóstico
e a leitura do código não indicou fluxo direto de dados dos endpoints HTTP do
Core para esses registros. Os pontos de produção com dados dinâmicos
identificados no Core foram tratados acima.

Nenhum commit, push, PR, configuração remota ou alteração de workflow foi feito.
