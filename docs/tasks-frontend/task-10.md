# Front-end [10] — Mecanismo visual de feedback

**Status:** implementada na branch `feat/frontend-message-feedback`, a partir de
`itia/develop` (`1acdf5d0`, que já contém a Task 09 via PR #193).
**Push/PR/merge:** não executados.

**Escopo:** `apps/chat-omnia` e documentação diretamente relacionada. Nenhuma
alteração no Back-end.

---

## 1. Diagnóstico

- Fluxo encontrado: `ChatInput → MiniChat/ExpandedChat → App.addMessage() →
MessageList → MessageItem`. A resposta da IA é a string fixa
  `'Mensagem recebida.'`.
- `MessageProps` continha apenas `content` e `author`; `MessageList` usava
  `author + índice` como chave. Não havia identificador estável no front-end.
- Back-end expõe `message_id` obrigatório em `Message`, `ConversationMessage` e
  `ChatResponse`, mas não há rota, modelo ou documento de feedback em
  `apps/chat-back` ou `docs`.
- Task 06 (P1-T06, PR #19) está presente e documentada: mensagens e campo de
  envio com validação visual local; a resposta fixa não é uma resposta real de
  IA. Falta, para esta task, um identificador estável no modelo visual.

## 2. Contrato de feedback

**Não existe.** Não foi possível confirmar formato da avaliação, valores
permitidos, identificador a enviar, necessidade de `conversation_id`, campo de
comentário, possibilidade de alteração, confirmação do servidor nem regras de
duplicidade. Por isso:

- nenhuma rota, payload ou propriedade de Back-end foi inventada;
- nenhuma persistência foi simulada;
- o envio é uma função opcional injetada no hook e **não é fornecida** nesta
  branch.

Back-end e equipe de IA precisam definir os itens acima antes da integração.

## 3. Estratégia

- `ChatMessage` (= `MessageProps` + `message_id`) passou a ser o tipo das
  mensagens em estado. O id local é criado uma única vez na inserção, com
  contador em `useRef`, e substituído pelo `message_id` real quando o fluxo de
  mensagens for integrado.
- `useMessageFeedback` mantém estado isolado por `message_id`, com transições
  `idle → selected → submitting → submitted | error`, guarda de envio
  concorrente, limpeza na nova conversa e erro genérico em pt-BR.
- `MessageFeedback` usa `ThumbsUp`/`ThumbsDown` do Lucide, `aria-pressed`,
  `aria-label`, `role="status"`/`role="alert"`, desabilita os botões durante o
  processamento e após confirmação, e usa `flex-wrap` para telas menores.
- `MessageList` usa `message_id` como chave e entrega o estado/callback apenas a
  respostas da IA. Componentes visuais não executam HTTP.

## 4. Arquivos

**Criados:** `src/hooks/useMessageFeedback.ts`,
`src/interface/messages/MessageFeedback.tsx`, `docs/interface/MessageFeedback.md`,
`docs/tasks-frontend/task-10.md`.

**Modificados:** `src/App.tsx`, `src/interface/messages/MessageItem.tsx`,
`src/interface/messages/MessageList.tsx`, `src/interface/chat/MiniChat.tsx`,
`src/interface/chat/ExpandedChat.tsx`, `docs/interface/MessageItem.md`,
`docs/interface/MessageList.md`, `docs/interface/App.md`,
`docs/interface/fonte-de-dados.md`, `apps/chat-omnia/README.md`.

## 5. Integração

Nenhuma integração com Back-end foi realizada: não há contrato para isso. Os
estados `submitting`/`submitted`/`error` estão implementados no hook e são
ativados somente quando uma função de envio real for injetada. Atualmente o
usuário vê a escolha destacada, sem mensagem de "registrado" e sem fingir
persistência.

## 6. Compatibilidade

Histórico, sugestões, nova conversa, envio local e renderização de mensagens
foram preservados. O feedback de uma mensagem não afeta outra e é descartado ao
iniciar nova conversa.

## Atualização de tratamento de falha

Na continuação da Task 10, o hook passou a entrar no estado `error` após uma
falha de envio, preservando a avaliação e a mensagem genérica em pt-BR. Como os
botões não ficam bloqueados nesse estado, o usuário pode tentar novamente com
Like ou Dislike. Exceções síncronas da função injetada também seguem o mesmo
tratamento.

O adaptador continua não sendo fornecido: não existe contrato/endpoint de
feedback no Back-end. O clique atual apenas destaca a escolha na interface e
não declara persistência. A continuação foi feita na branch local
`feat/frontend-message-feedback-followup`, pois `feat/frontend-message-feedback`
já existia em outro worktree e seu histórico estava integrado em `develop`.

Validações da continuação: typecheck, lint, build, Prettier nos arquivos
alterados e `git diff --check` passaram. `format:check` global não passou:
Prettier sinalizou `apps/chat-omnia/README.md` e os arquivos gerados em `dist/`.
A suíte de testes de interface continua inexistente.
