# MiniChat

## Identificação

- **Task:** P1-T04
- **Nome da task:** Construir o Mini Chat
- **Status registrado:** Concluída e integrada
- **PR registrado:** #8
- **Título do PR:** `feat: implementa mini chat`

## Objetivo

Criar a janela compacta exibida após a ativação do botão flutuante.

## Composição registrada

O `MiniChat` foi documentado como uma composição de:

```text
MiniChat
├── ChatHeader
├── ChatStateView
├── MessageList
└── ChatInput
```

O registro histórico indica props relacionadas a `isExpanded`, `onToggleExpanded`, `messages`, `onSendMessage` e `state`. Confirme os nomes e tipos no arquivo atual antes de usá-los como contrato.

## Composição atual (Front-end [08])

```text
MiniChat
├── ChatHeader
├── ChatStateView
├── MessageList
├── SuggestionList   ← novo
└── ChatInput
```

Props adicionadas:

```ts
suggestions: LoadedData<Suggestion>;
onSelectSuggestion: (suggestion: Suggestion) => void;
```

`SuggestionList` fica entre as mensagens e o input, com altura limitada e
scroll próprio. O histórico **não** aparece no modo compacto, para preservar a
janela de 320 px. `onSelectSuggestion` é repassado por `App.tsx`, que converte o
texto da sugestão em mensagem local.

## Responsabilidades

A visualização compacta organiza os componentes de cabeçalho, estados visuais, mensagens e entrada. O envio visual delega a atualização da conversa ao componente pai, em vez de concentrar toda a lógica no próprio `MiniChat`.

## Integração com App

```text
FloatingChatButton
        ↓
       App
        ↓
   isOpen = true
        ↓
     MiniChat
```

O `App` é o ponto de coordenação do estado de abertura.

## Escopo histórico

A task visual não implementou, por si só, a IA real, chamadas de API, REST, SSE, RAG ou persistência real.

## Validação registrada

- `npm run format`
- `npm run build`
- teste manual de abertura e fechamento

## Manutenção

Manter a visualização compacta separada da expandida evita duplicar a estrutura de apresentação. A lógica compartilhada de mensagens e integração deve ficar em uma camada apropriada, e não ser duplicada nas duas visualizações.

> Confira `MiniChat.tsx` e os componentes filhos para validar a implementação atual.
