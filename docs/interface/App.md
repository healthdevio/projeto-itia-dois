# App

## Papel na Interface

O `App` coordena partes do estado compartilhado da interface e compõe os componentes principais do chat.

## Responsabilidades registradas

Os documentos históricos indicam que `App` controla o estado de abertura (`isOpen`), a expansão (`isExpanded`) e as mensagens mantidas durante a alternância entre `MiniChat` e `ExpandedChat`.

O fluxo de abertura registrado é:

```text
FloatingChatButton
       ↓
      App
       ↓
  isOpen = true
       ↓
    MiniChat
```

A documentação também descreve `App.addMessage()` como parte do fluxo histórico de envio de mensagens.

## Integração e limites

A documentação da Task 06 esclarece que a resposta temporária “Mensagem recebida.” era apenas um mecanismo de validação visual, não uma resposta real da IA. A Task 08, por sua vez, contém um WIP antigo para sugestões e não deve ser considerada concluída apenas por existir um commit.

## Estado atual (Front-end [08])

`src/App.tsx` continua com `isOpen`, `isExpanded`, `messages` e `state` fixo em
`greeting`. O envio permanece local e fixo (`'Mensagem recebida.'`) — a ligação
desses estados ao Core é outra task.

A Task 08 acrescentou apenas:

- `useChatData(mockChatDataSource)`, que fornece sugestões e histórico;
- `handleSelectSuggestion`, que reaproveita `addMessage` com o texto da sugestão;
- props `suggestions`/`onSelectSuggestion` para `MiniChat` e `ExpandedChat`, e
  `history` para `ExpandedChat`.

Não há cliente REST, OIDC, token, SSE nem chamada a endpoints do Back-end. Ver
[fonte de dados](fonte-de-dados.md).

## Feedback (Front-end [10])

`App` cria um `message_id` local estável por mensagem no momento da inserção
(contador em `useRef`) e mantém `messages` como `ChatMessage[]`. O hook
`useMessageFeedback` guarda o estado de avaliação por `message_id` e é passado
por `MiniChat`/`ExpandedChat` até `MessageList`. Nenhuma função de envio é
injetada: o clique apenas registra a escolha visual, sem persistência e sem
chamada HTTP. A criação de nova conversa limpa os estados de feedback.

## Boas práticas

- Manter o estado no nível apropriado para os componentes que o compartilham.
- Evitar concentrar indefinidamente responsabilidades de interface, transporte e domínio em um único componente.
- Usar a camada de transporte para comunicação HTTP, conforme a arquitetura definida.
- Mapear explicitamente os modelos da Interface para os contratos do Backend.

## Validação

Após alterações, executar typecheck/build e testes aplicáveis, além de revisar `git diff --check`.
