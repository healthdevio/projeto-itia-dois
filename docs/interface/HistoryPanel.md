# HistoryPanel

## Identificação

- **Task:** Front-end [08] — Implementar sugestões e histórico
- **Arquivo:** `apps/chat-omnia/src/interface/history/HistoryPanel.tsx`
- **Estado:** implementado na Interface; integração com o Core **não** está feita

## Objetivo

Apresentar as **conversas anteriores** do usuário, em painel lateral do chat
expandido. Não mistura mensagens da conversa ativa com conversas passadas.

## O que é "histórico" no contrato

`GET /api/conversations/current` devolve um `ConversationView` com duas listas
distintas:

| Campo                                                 | Conteúdo                                              | Onde aparece na Interface      |
| ----------------------------------------------------- | ----------------------------------------------------- | ------------------------------ |
| `data.messages` / `data.active_conversation.messages` | mensagens da conversa **ativa**                       | `MessageList`                  |
| `data.history`                                        | conversas **anteriores**, cada uma com suas mensagens | `HistoryPanel` / `HistoryItem` |

O Back-end mantém exatamente **uma conversa ativa por usuário**; `POST
/api/conversations/rotate` encerra a atual e cria outra. `data.history` vem da
ordenação por `updated_at` (mais recente primeiro) com limite configurado no
repositório.

`ChatDataSource.getHistory()` mapeia `data.history`. A conversa ativa continua
fora desta área até a task de transporte/estados do chat.

## Contrato usado

```ts
interface Conversation {
  id: string;
  state: 'idle' | 'streaming' | 'success' | 'error';
  messages: ConversationMessage[];
  created_at: string;
  updated_at: string;
}
```

Origem: `apps/chat-back/src/models/conversation.ts`. Datas são ISO 8601 e são
formatadas em pt-BR por `src/utils/formatDateTime.ts`, que tolera valor ausente
ou inválido retornando `null`.

```json
{
  "success": true,
  "data": {
    "id": "9f1c2a44-...",
    "state": "idle",
    "messages": [],
    "active_conversation": { "...": "..." },
    "history": [
      {
        "id": "4d3e913d-...",
        "state": "idle",
        "messages": [],
        "created_at": "2026-09-27T10:00:00.000Z",
        "updated_at": "2026-09-27T10:04:12.000Z"
      }
    ]
  }
}
```

## Props

```ts
interface HistoryPanelProps {
  data: LoadedData<Conversation>;
}
```

## Estados

| `status`                | Comportamento                                                             |
| ----------------------- | ------------------------------------------------------------------------- |
| `loading`               | Painel lateral com `role="status"` e `LoadingIndicator`                   |
| `ready` com lista vazia | Não renderiza nada                                                        |
| `ready` com itens       | `<aside aria-label="Histórico de conversas">` com `<ol>` de `HistoryItem` |
| `error`                 | Painel com `role="alert"` e mensagem genérica em pt-BR                    |

## Layout

O painel aparece **somente no modo expandido**, ao lado de `MessageList`, com
largura relativa (`w-2/5 max-w-48`). No modo compacto (`MiniChat`) ele não
aparece, para não quebrar a janela de 320 px.

## Pendências

- Não há rota de "abrir conversa anterior": `HistoryItem` não é botão e não houve
  seleção implementada.
- Botão de rotação (`POST /api/conversations/rotate`) fica de fora: a task não
  autoriza mexer no fluxo de conversa.
- Cliente REST e OIDC (outra trilha).
- Testes de Interface.
