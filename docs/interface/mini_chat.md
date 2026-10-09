# P1-T04 --- Mini Chat

-   **Task:** P1-T04
-   **Nome:** Construir o Mini Chat
-   **Status:** Concluída e integrada
-   **PR:** #8
-   **Título do PR:** `feat: implementa mini chat`

## Objetivo

Criar a primeira janela do chatbot após a ativação do botão flutuante.

## Implementação

O `MiniChat` passou a compor:

``` text
MiniChat
├── ChatHeader
├── ChatStateView
├── MessageList
└── ChatInput
```

O componente recebe:

``` ts
isExpanded
onToggleExpanded
messages
onSendMessage
state
```

O envio visual transforma o conteúdo digitado em uma mensagem de usuário
e delega a atualização ao componente pai.

## Integração com App

O fluxo ficou:

``` text
FloatingChatButton
        ↓
      App
        ↓
    isOpen=true
        ↓
    MiniChat
```

O `App` permanece como ponto de coordenação do estado de abertura.

## Fora do escopo

O PR explicitamente não implementou:

-   Mia AI;
-   API;
-   REST;
-   SSE;
-   RAG;
-   banco vetorial;
-   persistência real.

Isso foi uma decisão correta de escopo: a task precisava entregar a
interface, não antecipar a integração.

## Validação

-   `npm run format`
-   `npm run build`
-   teste manual de abertura e fechamento.

## Critérios de aceite

-   [x] Mini Chat aparece após ativação.
-   [x] Estrutura visual organizada.
-   [x] Abertura controlada pelo estado do pai.
-   [x] Preparado para expansão.
-   [x] Sem lógica interna da IA.
-   [x] Build aprovado.

## Observação arquitetural

A composição por componentes pequenos favorece manutenção e evolução.
Entretanto, conforme o projeto avançou, `App.tsx` passou a concentrar
responsabilidades de estado. Essa é uma área a ser revisada antes das
integrações reais.
