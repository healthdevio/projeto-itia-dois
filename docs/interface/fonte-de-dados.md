# Fonte de dados da Interface

## Objetivo

Documentar o ponto de troca entre os componentes visuais e a futura camada de
transporte REST. Nesta task **não há cliente REST, OIDC, token nem `fetch` no
frontend**: os dados vêm de um adaptador mock.

## Arquivos

| Arquivo                                               | Papel                                                |
| ----------------------------------------------------- | ---------------------------------------------------- |
| `apps/chat-omnia/src/types/chat-contracts.ts`         | Tipos que espelham somente os modelos do Back-end    |
| `apps/chat-omnia/src/transport/ChatDataSource.ts`     | Interface `ChatDataSource` — ponto de troca          |
| `apps/chat-omnia/src/transport/mockChatDataSource.ts` | TEMPORÁRIO: fixtures em memória                      |
| `apps/chat-omnia/src/hooks/useChatData.ts`            | Hook que consome a interface e expõe `LoadedData<T>` |
| `apps/chat-omnia/src/utils/formatDateTime.ts`         | Formatação ISO 8601 → pt-BR, tolerando ausência      |

## Interface

```ts
interface ChatDataSource {
  getSuggestions(): Promise<Suggestion[]>;
  getHistory(): Promise<Conversation[]>;
  startNewConversation(): Promise<Conversation>;
}
```

- `getSuggestions()` mapeia `data.suggestions` de `GET /api/suggestions`.
- `getHistory()` mapeia `data.history` de `GET /api/conversations/current`
  (conversas anteriores). Mensagens da conversa ativa ficam fora desta interface
  e continuam no estado local de `App.tsx`.
- `startNewConversation()` mapeia `data` de `POST /api/conversations/rotate` e
  devolve a `Conversation` criada pelo Back-end. A interface não monta esse
  objeto nem gera identificadores: a fonte de dados é a única responsável por
  devolver a conversa autoritativa.

A interface devolve somente os dados do domínio. A implementação REST futura é
responsável por desembrulhar o envelope `ApiResponse<T>`:

```json
{ "success": true, "data": { "suggestions": [] } }
{ "success": false, "error": "Erro interno ao obter as sugestões" }
```

## Estados da Interface

`useChatData` expõe `LoadedData<T>`, que **não** é um contrato do Back-end:

```ts
type LoadStatus = 'loading' | 'ready' | 'error';

interface LoadedData<T> {
  status: LoadStatus;
  items: T[];
  error?: string;
}
```

Mensagens de erro são fixas e genéricas em pt-BR; detalhes técnicos não são
repassados à tela. O hook usa um sinalizador `ativo` para ignorar respostas
tardias após desmontagem.

## Fluxo

```text
mockChatDataSource (temporário)
        ↓ implementa
ChatDataSource
        ├── consumida por useChatData → suggestions / history / reloadHistory
        └── consumida por useNewConversation → status / erro / nova Conversation
                    ↓
              App.tsx (estado da tela)
                    ↓
        MiniChat / ExpandedChat → ChatHeader / SuggestionList / HistoryPanel
```

Nenhum componente visual conhece a origem dos dados. Para trocar o mock pelo
REST, basta passar outra implementação de `ChatDataSource` aos hooks: os
componentes não mudam.

`useNewConversation` impede acionamentos concorrentes e só devolve a conversa
após a fonte confirmar a operação. O `App` limpa mensagens e volta ao estado
inicial somente com essa resposta; em falha, a conversa anterior é preservada e
a tela mostra uma mensagem genérica em pt-BR.

O `mockChatDataSource.startNewConversation()` é uma **simulação local**: seu
identificador e os dados são fixtures de teste e não representam uma conversa
confirmada pelo Back-end. Na implementação REST ele é substituído por
`POST /api/conversations/rotate`.

## Contratos de origem

- `apps/chat-back/src/models/suggestion.ts`
- `apps/chat-back/src/models/conversation.ts`
- `apps/chat-back/src/models/message.ts`
- `apps/chat-back/src/models/api-response.ts`
- `docs/backend/Suggestion.md`
- `docs/backend/Conversation.md`

## O que falta

- implementação REST de `ChatDataSource` com rotas relativas `/api/...` via Nginx,
  incluindo `POST /api/conversations/rotate` para `startNewConversation()`;
- autenticação OIDC e envio do Bearer token no frontend;
- carregamento das mensagens da conversa ativa (`data.messages`) e ligação dos
  estados `idle`/`streaming`/`success`/`error`;
- chamadas a `POST`/`DELETE /api/suggestions` quando a sugestão for selecionada;
- SSE/streaming, se fizer parte de uma task futura;
- contrato de feedback de mensagens (formato, identificadores, confirmação e
  regras de duplicidade) antes de injetar o envio em `useMessageFeedback`;
- suíte de testes de Interface.
