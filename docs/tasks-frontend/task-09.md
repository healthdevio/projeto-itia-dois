# Front-end [09] — Nova conversa

**Status:** implementada na branch `feat/frontend-new-conversation`, a partir de
`itia/develop` (`705e614e`). **Push/PR/merge:** não executados.

**Escopo:** `apps/chat-omnia` e documentação diretamente relacionada em
`docs/interface/`. Nenhuma alteração no Back-end.

---

## 1. Diagnóstico

- `POST /api/conversations/rotate` existe, exige Bearer OIDC via `IdentityGuard`,
  não recebe payload e responde `200` com `ApiResponse<Conversation>`. Falha:
  `500` com erro genérico.
- `rotateConversation()` inativa a conversa anterior (que passa a compor o
  histórico) e cria uma nova com `randomUUID`, `state: 'idle'` e `messages: []`.
- O front-end não tinha abstração para rotação: `ChatDataSource` só expunha
  `getSuggestions()` e `getHistory()`, `App.tsx` mantinha `state` fixo em
  `greeting` e não identificava a conversa ativa.
- Não há cliente REST, token ou SSE na branch; o único adaptador é o mock.

## 2. Estratégia

- `ChatDataSource` ganhou `startNewConversation(): Promise<Conversation>`,
  devolvendo a conversa da fonte de dados. O `App` não cria `Conversation` nem
  gera identificadores.
- `useNewConversation` centraliza status (`idle`/`starting`/`error`), guarda de
  duplo acionamento e erro genérico em pt-BR. Só devolve a conversa após a fonte
  confirmar a operação.
- `useChatData` ganhou `reloadHistory()` para o histórico refletir a rotação;
  falha nessa atualização preserva o histórico anterior.
- `ChatHeader` passa a ter o botão "Nova conversa" (desabilitado durante a
  operação) e o alerta de erro; `MiniChat` e `ExpandedChat` apenas repassam a
  propriedade — nenhum componente visual chama HTTP.
- O `App` limpa mensagens, troca o estado visual e remonta as janelas com a
  `key` do `id` retornado somente depois do sucesso. Sugestões e histórico
  permanecem intactos.

## 3. Arquivos alterados

- `apps/chat-omnia/src/transport/ChatDataSource.ts`
- `apps/chat-omnia/src/transport/mockChatDataSource.ts`
- `apps/chat-omnia/src/hooks/useNewConversation.ts` (novo)
- `apps/chat-omnia/src/hooks/useChatData.ts`
- `apps/chat-omnia/src/interface/components/ChatHeader.tsx`
- `apps/chat-omnia/src/interface/chat/MiniChat.tsx`
- `apps/chat-omnia/src/interface/chat/ExpandedChat.tsx`
- `apps/chat-omnia/src/App.tsx`
- `docs/interface/fonte-de-dados.md`
- `docs/tasks-frontend/task-09.md` (novo)

## 4. Integração e limitações

A operação foi integrada apenas à abstração `ChatDataSource`. Como não há
cliente REST nem autenticação nesta branch, a implementação ativa continua sendo
`mockChatDataSource`, cuja rotação é **simulação local** e não deve ser
interpretada como confirmação do Back-end. A implementação REST ainda deve
chamar `POST /api/conversations/rotate` com Bearer e desembrulhar
`ApiResponse<Conversation>`; isso depende de task de transporte/autenticação
separada e não foi feito aqui.

## 5. Comportamento

- Botão "Nova conversa" no cabeçalho; fica desabilitado e mostra "Iniciando..."
  durante a operação.
- Em sucesso: mensagens da conversa anterior desaparecem, estado visual volta a
  `greeting`, identificador da conversa é atualizado e o histórico é recarregado.
- Em falha: mensagem "Não foi possível iniciar uma nova conversa. Tente
  novamente." e conversa anterior preservada.
- Cliques repetidos durante a operação são ignorados pela guarda do hook.
