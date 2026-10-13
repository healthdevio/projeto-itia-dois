# Interface do Chat Omnia

A tela do chat: botão flutuante, janela compacta, janela expandida, lista de
mensagens e sugestões. React com Vite, Tailwind e componentes do shadcn.

## Início rápido

```bash
npm install
npm run dev
```

Em <http://localhost:5173>. Para build de produção:

```bash
npm run build     # tsc -b && vite build
npm run preview   # serve o dist
```

A interface não tem `.env` próprio. Em produção o nginx em `apps/docker/nginx.conf`
serve o bundle e encaminha `/api` para o Core, então o frontend chama `/api/...`
em caminho relativo e não sabe em que host está rodando.

## O que a tela tem

```
App
├── FloatingChatButton        abre e fecha o chat
├── MiniChat                  janela compacta, 320x384
└── ExpandedChat              janela expandida, 600 de largura, altura da tela
    ├── ChatHeader            título e botão de expandir
    ├── ChatStateView         greeting, idle, thinking ou error
    ├── MessageList → MessageItem
    ├── SuggestionList        esboço, devolve null
    ├── HistoryPanel          esboço, devolve null
    └── ChatInput             campo e envio por Enter
```

`MiniChat` e `ExpandedChat` repetem a mesma montagem com tamanhos diferentes.
Não há componente de janela compartilhado entre os dois — a decisão de layout
está duplicada de propósito, para cada um poder ter as suas medidas.

## Estado da tela

Quatro estados, definidos pelo tipo `ChatStateViewProps`:

| Estado | O que mostra |
| ------ | ------------ |
| `greeting` | "Como posso ajudar?" |
| `idle` | nada — só as mensagens |
| `thinking` | indicador de carregamento |
| `error` | "Não foi possível enviar sua mensagem." |

O `App.tsx` mantém `state` com `useState` e **nunca muda o valor** — ele fica em
`greeting` a vida inteira. É o que falta para a tela estar conectada: quem vai
trocar `greeting` por `idle` ao enviar, e `idle` por `thinking` durante a
requisição, é o mesmo lugar que vai chamar a API.

## O que ainda não está ligado à API

`src/transport/rest/` e `src/transport/sse/` existem e estão vazios. É onde
moram o cliente HTTP e o de streaming. O `App.tsx` hoje faz assim:

```tsx
const addMessage = (message: MessageProps) => {
  setMessages((currentMessages) => [
    ...currentMessages,
    message,
    { content: 'Mensagem recebida.', author: 'omnia' },
  ]);
};
```

A resposta é fixa e local. Nada sai para a rede. Quando o `transport` existir, é
esse `addMessage` que passa a aguardar a resposta do Core, e o
`{ content: 'Mensagem recebida.' }` sai de cena.

O `SuggestionList` e o `HistoryPanel` devolvem `null` — estão marcados para os
endpoints que o Core já expõe (`/api/suggestions` e `/api/conversations`).

## Comandos

| Comando | O que faz |
| ------- | --------- |
| `npm run dev` | Vite em modo desenvolvimento |
| `npm run build` | typecheck e build em `dist/` |
| `npm run preview` | serve o `dist/` |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc -b` |

O `format` e o `format:check` desta pasta existem, mas quem manda é o da raiz:
ele cobre o repositório inteiro com um conjunto só de regras.

## Deploy

A interface vira a imagem `chat-web`, construída pelo `Dockerfile.web` e
publicada no `ghcr.io` pelo CD. O nginx que ela serve está em
`apps/docker/nginx.conf`.

| | |
| --- | --- |
| Homologação | <http://167.126.20.64:8080> |
| Produção | <http://167.126.20.64> |

Detalhamento em [`docs/ci_cd/deploy.md`](../../docs/ci_cd/deploy.md).

## Documentação

| Documento | Assunto |
| --------- | ------- |
| [estrutura_componentes.md](../../docs/interface/estrutura_componentes.md) | Os componentes e o que cada um faz |
| [chat_expandido.md](../../docs/interface/chat_expandido.md) | A janela expandida |
| [mini_chat.md](../../docs/interface/mini_chat.md) | A janela compacta |
| [botao_flutuante.md](../../docs/interface/botao_flutuante.md) | O botão que abre o chat |
| [mensagens_e_envio.md](../../docs/interface/mensagens_e_envio.md) | Mensagens e envio |
| [estados_visuais.md](../../docs/interface/estados_visuais.md) | Os quatro estados |
| [sugestoes_e_historicos.md](../../docs/interface/sugestoes_e_historicos.md) | Sugestões e histórico |
| [configuracao_ambiente.md](../../docs/interface/configuracao_ambiente.md) | Configuração da interface |

O contrato do backend está em [`docs/core/`](../../docs/core/README.md), e a
pipeline em [`docs/ci_cd/`](../../docs/ci_cd/README.md).