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
}
```

- `getSuggestions()` mapeia `data.suggestions` de `GET /api/suggestions`.
- `getHistory()` mapeia `data.history` de `GET /api/conversations/current`
  (conversas anteriores). Mensagens da conversa ativa ficam fora desta interface
  e continuam no estado local de `App.tsx`.

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
        ↓ consumida por
useChatData
        ↓ props: LoadedData<Suggestion> / LoadedData<Conversation>
MiniChat / ExpandedChat
        ↓
SuggestionList / HistoryPanel / HistoryItem
```

Nenhum componente visual conhece a origem dos dados. Para trocar o mock pelo
REST, basta passar outra implementação de `ChatDataSource` para `useChatData`:
os componentes não mudam.

## Contratos de origem

- `apps/chat-back/src/models/suggestion.ts`
- `apps/chat-back/src/models/conversation.ts`
- `apps/chat-back/src/models/message.ts`
- `apps/chat-back/src/models/api-response.ts`
- `docs/backend/Suggestion.md`
- `docs/backend/Conversation.md`

## O que falta

- implementação REST de `ChatDataSource` com rotas relativas `/api/...` via Nginx;
- autenticação OIDC e envio do Bearer token no frontend;
- carregamento das mensagens da conversa ativa (`data.messages`) e ligação dos
  estados `idle`/`streaming`/`success`/`error`;
- chamadas a `POST`/`DELETE /api/suggestions` quando a sugestão for selecionada;
- SSE/streaming, se fizer parte de uma task futura;
- suíte de testes de Interface.
