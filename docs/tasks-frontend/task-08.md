# Front-end [08] — Sugestões e histórico

**Status:** implementado no working tree; integração com o Core **não** realizada.  
**Branch de implementação:** `feat/integracao-host-task-01`; **branch deste commit:** `feat/implementar-sugestoes-histórico`.  
**Escopo autorizado:** `apps/chat-omnia` e documentação diretamente relacionada em `docs/interface/` (mais este registro em `docs/tasks-frontend/`).  
**Commit:** será registrado na branch atual. **Push/PR/merge:** não executados.

---

## 1. Objetivo

Criar áreas para sugestões de interação e histórico de conversas usando **somente os modelos definidos pelo Back-end**, sem assumir regras internas da Omnia IA e sem implementar transporte REST, OIDC, token ou SSE.

Antes desta task:

- `SuggestionList`, `HistoryPanel` e `HistoryItem` eram esboços com `return null`;
- `App.tsx` mantinha `isOpen`, `isExpanded`, `messages` e `state` fixo em `greeting`;
- o envio era local e fixo (`'Mensagem recebida.'`);
- `src/transport/rest/` e `src/transport/sse/` eram apenas diretórios planejados;
- não havia suíte de testes de interface.

---

## 2. Passo 0 — contratos reais conferidos no código

A fonte da verdade foi o código do branch, não o contexto histórico.

### 2.1 Sugestão

Origem: `apps/chat-back/src/models/suggestion.ts`.

```ts
interface Suggestion {
  suggestion_id: string;
  text: string;
}
```

- `suggestion_id` é único **dentro da conversa**, não no banco inteiro.
- Limites do Back-end: no máximo 8 sugestões por conversa, texto com até 500 caracteres e id com até 128.
- Texto vazio é descartado; quando o id não é informado ou é inválido, o Back-end gera `sg-<uuid>`.

### 2.2 Mensagem e conversa

Origens: `apps/chat-back/src/models/message.ts`, `conversation.ts`, `conversation-state.ts`.

```ts
interface Message {
  message_id: string;  // obrigatório
  message: string;     // obrigatório
  date?: string;       // opcional, ISO 8601
  metadata?: string;   // opcional
  origin: string;      // obrigatório
}

interface ConversationMessage extends Message {
  role: 'user' | 'assistant';
}

type ConversationState = 'idle' | 'streaming' | 'success' | 'error';

interface Conversation {
  id: string;
  state: ConversationState;
  messages: ConversationMessage[];
  created_at: string;
  updated_at: string;
}

interface ConversationView {
  id: string;
  state: ConversationState;
  messages: ConversationMessage[];
  active_conversation: Conversation;
  history: Conversation[];
}
```

### 2.3 Envelope de resposta

Origem: `apps/chat-back/src/models/api-response.ts`.

```ts
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}
```

Formas observadas:

```json
{ "success": true, "data": { "suggestions": [] } }
{ "success": false, "error": "Erro interno ao obter as sugestões" }
```

### 2.4 Rotas

| Rota                             | Controller                    | Retorno em `data`               |
| -------------------------------- | ----------------------------- | ------------------------------- |
| `GET /api/conversations/current` | `conversations.controller.ts` | `ConversationView`              |
| `GET /api/conversations/active`  | `conversations.controller.ts` | `Conversation`                  |
| `POST /api/conversations/rotate` | `conversations.controller.ts` | nova `Conversation` ativa       |
| `GET /api/suggestions`           | `suggestions.controller.ts`   | `{ suggestions: Suggestion[] }` |
| `POST /api/suggestions`          | `suggestions.controller.ts`   | `{ suggestions: Suggestion[] }` |
| `DELETE /api/suggestions`        | `suggestions.controller.ts`   | `{ deleted: number }`           |

`GET /api/conversations/current` devolve `data.history` e `data.active_conversation`.  
`GET /api/conversations/active` devolve somente a conversa ativa.  
`POST /api/conversations/rotate` encerra a conversa atual e cria outra com `state: 'idle'`.

### 2.5 O que é “histórico”

**Histórico = conversas anteriores**, representadas por `data.history` em `ConversationView`.

Não são as mensagens da conversa atual. As mensagens ativas ficam em:

- `data.messages`; e
- `data.active_conversation.messages`.

Por isso:

- `MessageList` continua cuidando das mensagens da conversa ativa;
- `HistoryPanel` mostra apenas `data.history`.

O repositório `conversation-repository.ts` confirma que:

- existe uma conversa ativa por usuário (`isActive: true`);
- `loadHistory()` seleciona conversas com `isActive: false`;
- ordena por `updated_at` descendente;
- limita a 20 conversas (`HISTORY_LIMIT = 20`);
- `rotateConversation()` marca a atual como inativa e cria uma nova.

### 2.6 Campos opcionais ou que podem vir vazios

- `date` e `metadata` são opcionais em `Message`;
- `history` pode ser `[]`;
- `suggestions` pode ser `[]`;
- `messages` pode ser `[]`;
- `error` só aparece no envelope de falha;
- `data` só aparece no envelope de sucesso;
- `created_at`, `updated_at`, `id`, `state` e `role` são obrigatórios no contrato.

### 2.7 Divergências documentação × código

1. `docs/backend/Suggestion.md:65` afirma que todos os endpoints exigem `X-User-Id`. O código usa `IdentityGuard` com `Authorization: Bearer <JWT OIDC>`; headers `X-User-Id`/`X-Tenant-Id` são ignorados.
2. `docs/backend/Conversation.md:409` ainda contém TODO: “Autenticação de verdade: validar token e derivar `user_id` de um subject, em vez de confiar no header”. O middleware já faz isso, então o TODO está desatualizado.
3. Os documentos históricos de `docs/interface/` marcavam a Task 08 como WIP e os componentes como não implementados. O código do branch agora está implementado e a documentação foi ajustada.

---

## 3. Arquitetura da solução

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

Regras seguidas:

- nenhum componente visual chama `fetch`;
- componentes recebem dados por props;
- texto do Back-end é renderizado como **texto**, nunca com `dangerouslySetInnerHTML`;
- o ponto de troca pelo REST é a interface `ChatDataSource`;
- mensagens de erro são fixas e genéricas em pt-BR, sem detalhes técnicos;
- nenhuma dependência nova foi adicionada.

---

## 4. Arquivos criados

### `apps/chat-omnia/src/types/chat-contracts.ts`

Tipos TypeScript que espelham somente os modelos do Back-end:

- `ConversationState`
- `Suggestion`
- `Message`
- `ConversationMessage`
- `Conversation`
- `ConversationView`
- `ApiResponse<T>`
- `SuggestionsData`

Comentários indicam o arquivo de origem no Back-end. Não há importação de código do Back-end para o frontend e não foram criadas regras de negócio novas.

### `apps/chat-omnia/src/transport/ChatDataSource.ts`

Interface pequena e desacoplada:

```ts
interface ChatDataSource {
  getSuggestions(): Promise<Suggestion[]>;
  getHistory(): Promise<Conversation[]>;
}
```

Documenta que:

- `getHistory()` mapeia `data.history`, ou seja, conversas anteriores;
- mensagens da conversa ativa ficam fora desta interface;
- a implementação REST futura deve desembrulhar `ApiResponse<T>`.

### `apps/chat-omnia/src/transport/mockChatDataSource.ts`

Adaptador temporário com fixtures em memória:

- 3 sugestões;
- 2 conversas anteriores;
- mensagens com `role`, `origin`, `date`, `created_at` e `updated_at`.

Está claramente marcado como temporário. Não faz rede, não faz OIDC e não representa dado real.

### `apps/chat-omnia/src/hooks/useChatData.ts`

Hook que consome `ChatDataSource` e expõe:

```ts
type LoadStatus = 'loading' | 'ready' | 'error';

interface LoadedData<T> {
  status: LoadStatus;
  items: T[];
  error?: string;
}
```

Carrega sugestões e histórico em paralelo. Usa uma flag `ativo` para ignorar respostas tardias após desmontagem. Mensagens de erro exibidas:

- `Não foi possível carregar as sugestões.`
- `Não foi possível carregar o histórico.`

### `apps/chat-omnia/src/utils/formatDateTime.ts`

Função pura que formata ISO 8601 em pt-BR com `Intl.DateTimeFormat`:

```ts
formatDateTime(value?: string): string | null
```

Retorna `null` para valor ausente ou inválido.

### `docs/interface/fonte-de-dados.md`

Documenta a arquitetura da fonte desacoplada, o mock, o envelope REST, os estados da Interface, o fluxo de dados e tudo o que falta (REST, OIDC, SSE, mensagens ativas, testes).

---

## 5. Arquivos alterados

### `src/App.tsx`

Mudanças mínimas:

- importou `useChatData` e `mockChatDataSource`;
- chamou `useChatData(mockChatDataSource)`;
- adicionou `handleSelectSuggestion`, que chama `addMessage({ content: suggestion.text, author: 'user' })`;
- passou `suggestions` e `onSelectSuggestion` para `MiniChat` e `ExpandedChat`;
- passou `history` para `ExpandedChat`.

`isOpen`, `isExpanded`, `messages`, `state` fixo em `greeting`, `toggleChat`, `addMessage` e a resposta local `'Mensagem recebida.'` foram mantidos.

### `src/interface/suggestions/SuggestionList.tsx`

De `return null` para lista acessível.

Props:

```ts
interface SuggestionListProps {
  data: LoadedData<Suggestion>;
  onSelect: (suggestion: Suggestion) => void;
}
```

Estados:

| Situação                | Comportamento                                           |
| ----------------------- | ------------------------------------------------------- |
| `loading`               | `role="status"` + `LoadingIndicator`                    |
| `ready` com lista vazia | não renderiza nada                                      |
| `ready` com itens       | `section` com `ul`/`li` e um `button` real por sugestão |
| `error`                 | `role="alert"` com mensagem genérica                    |

Acessibilidade:

- `aria-label="Sugestões"` na seção;
- `aria-label="Enviar sugestão: <texto>"` no botão;
- navegação por Tab/Enter;
- foco visível por `focus-visible:ring-2`.

`onSelect` apenas devolve a sugestão escolhida; o componente não decide o efeito.

### `src/interface/history/HistoryPanel.tsx`

De `return null` para painel lateral.

Props:

```ts
interface HistoryPanelProps {
  data: LoadedData<Conversation>;
}
```

Estados equivalentes aos de sugestões: carregando, vazio, erro e pronto. Usa `aside`, `h3` e `ol` semânticos. Só aparece no `ExpandedChat`.

### `src/interface/history/HistoryItem.tsx`

De `return null` para item de conversa anterior.

Exibe:

- `updated_at` em `<time dateTime=...>` formatado em pt-BR;
- `created_at` quando diferente de `updated_at`;
- quantidade de mensagens com singular/plural correto;
- prévia da última mensagem com prefixo `Você:` ou `Omnia:`, conforme `role`.

Não é botão: o contrato não expõe rota para reabrir conversa encerrada.

### `src/interface/chat/MiniChat.tsx`

Adicionou:

```ts
suggestions: LoadedData<Suggestion>;
onSelectSuggestion: (suggestion: Suggestion) => void;
```

`SuggestionList` ficou entre `MessageList` e `ChatInput`. Histórico não aparece no modo compacto.

### `src/interface/chat/ExpandedChat.tsx`

Adicionou as mesmas props de sugestão e:

```ts
history: LoadedData<Conversation>;
```

Layout alterado para:

```text
ChatHeader
ChatStateView
┌───────────────────────────┬──────────────┐
│ MessageList               │ HistoryPanel │
└───────────────────────────┴──────────────┘
SuggestionList
ChatInput
```

`MessageList` e `HistoryPanel` compartilham a altura com `flex min-h-0 flex-1`.

### `src/interface/messages/MessageList.tsx`

Correção pequena e necessária: a chave React passou de `author + content` para `author + index`.

Motivo: ao clicar duas vezes na mesma sugestão, duas mensagens com o mesmo texto e autor apareciam, gerando erro de chave duplicada no console. A lista é local e append-only, então o índice é suficiente e o comportamento visual não mudou.

### Documentação em `docs/interface/`

- `App.md` — registrou o estado atual e o que a Task 08 acrescentou.
- `MiniChat.md` — documentou nova composição, props e ausência do histórico no modo compacto.
- `ExpandedChat.md` — documentou o layout lado a lado e as novas props.
- `SuggestionList.md` — contrato, props, estados, acessibilidade, segurança e pendências.
- `HistoryPanel.md` — definição de histórico, contrato, estados e layout.
- `HistoryItem.md` — campos exibidos, tolerância a datas e ausência de seleção.
- `README.md` — índice atualizado e status honesto da integração com o Core.

---

## 6. Decisões de design

1. Sugestões aparecem no MiniChat e no ExpandedChat.
2. Histórico aparece somente no ExpandedChat, em painel lateral de largura relativa (`w-2/5 max-w-48`).
3. `onSelect` reaproveita o envio local existente: o texto vira mensagem do usuário e a resposta fixa continua aparecendo.
4. `HistoryItem` não é clicável, pois não há rota de reabertura no contrato.
5. Listas vazias não renderizam nada, para evitar ruído visual.
6. Erros usam mensagens genéricas em pt-BR.
7. O botão de rotação de conversa ficou de fora: a task não autoriza mexer no fluxo de conversa.

Essas decisões ficam registradas para validação do usuário.

---

## 7. Qualidade e segurança

- sem `any` desnecessário;
- sem dados sensíveis em logs;
- sem `dangerouslySetInnerHTML`;
- texto do Back-end tratado como dado, não como instrução;
- sem chamadas HTTP em componentes visuais;
- sem novas dependências;
- componentes com `aria-label` e foco visível;
- datas formatadas em pt-BR com tolerância a ausência;
- funções de formatação mantidas puras e fáceis de testar.

---

## 8. Validação executada

```powershell
cd apps/chat-omnia
npm ci            # não executado: dependências já presentes
npm run typecheck # passou
npm run lint      # passou
npm run build     # passou
cd ..\..
npm run format:check # passou
```

Também executados:

- `npx prettier --write` somente nos arquivos criados/alterados;
- `git diff --check` — passou.

### Verificação visual

Dev server subido em `http://127.0.0.1:5173` e testado no navegador:

1. botão flutuante abriu o chat;
2. MiniChat mostrou as três sugestões;
3. clique em sugestão adicionou o texto como mensagem local;
4. Enter em sugestão focada também funcionou;
5. expansão mostrou `HistoryPanel` ao lado das mensagens;
6. histórico exibiu datas pt-BR, contagem e prévia;
7. Tab alcançou os botões e o foco visível apareceu;
8. console final sem erros.

O dev server foi encerrado ao final.

**Nota:** durante a edição com o Vite já rodando apareceram erros transitórios de HMR e um erro de chave duplicada no console. Ambos foram resolvidos antes da verificação final: a chave em `MessageList` foi corrigida e a página foi recarregada.

---

## 9. O que ficou como mock/pendente

### Mockado

- sugestões e histórico vêm de `mockChatDataSource`;
- nenhuma chamada real ao Back-end.

### Pendente para outras tasks/trilhas

- cliente REST de `ChatDataSource` com rotas relativas `/api/...`;
- OIDC, token e envio de Bearer no frontend;
- carregamento das mensagens da conversa ativa (`data.messages`);
- ligação dos estados `idle`/`streaming`/`success`/`error` ao Core;
- `thinking`/`error` reais na interface;
- `POST`/`DELETE /api/suggestions`;
- botão de rotação de conversa;
- reabertura de conversa anterior;
- SSE/streaming;
- testes de UI.

### Proposta de testes, se aprovado

Como o projeto não tem suíte de interface, nada foi instalado. Para uma task futura, a dependência mínima sugerida é:

- `vitest`
- `@testing-library/react`
- `@testing-library/user-event`
- `jsdom`

Casos sugeridos:

- estados `loading`, vazio e erro;
- chamada de `onSelect` com a sugestão correta;
- texto renderizado como texto;
- formatação de data e fallback;
- navegação por teclado;
- ausência de painel de histórico no MiniChat.

---

## 10. Dependências não confirmadas

- Não foi possível confirmar se a Front-end [02] define outro padrão de transporte, hook ou estado que deva ser reutilizado.
- Não foi possível confirmar a existência de um cliente REST/OIDC oficial no frontend.
- Os contratos foram confirmados no código do branch, mas não em runtime: API rodando, rotas acessíveis via Nginx, configuração OIDC e dados reais.
- `.env`, secrets e configuração de autenticação não foram abertos.
- Não foi confirmado que os artefatos de Back-end [02, 03] estejam implantados no ambiente de destino exatamente com este formato de `ConversationView`/`Suggestion`.

---

## 11. Estado das alterações

As alterações da Task 08 foram transferidas para a branch
`feat/implementar-sugestoes-histórico` para serem commitadas separadamente.

- arquivos de código e documentação listados acima;
- seis `.gitkeep` deletados que já existiam antes da task foram preservados;
- as seis deleções de `.gitkeep` foram mantidas fora do commit por não fazerem
  parte da task;
- push, PR e merge permanecem não executados.
