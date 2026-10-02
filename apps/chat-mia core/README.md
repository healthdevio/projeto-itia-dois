# Chat Mia Core

O Core do Chat Mia é responsável por:

- Receber mensagens da interface e repassá-las para a Mia AI.
- Repassar para a Mia AI a configuração que a interface escolheu (idioma, tom,
  tamanho da resposta), preenchendo o que faltar com o default.
- Entregar a conversa atual para a interface.
- Entregar e registrar as sugestões da conversa atual.
- Guardar a conversa internamente, no Postgres.

> **A conversa nunca é enviada para a Mia AI.** Ela é estado interno do Core.
> Apenas as mensagens saem do Core — e cada envio carrega o contexto do diálogo
> para que a Mia AI tenha consciência do histórico.

## Multi-usuário

Cada usuário tem a sua própria conversa ativa e o seu próprio histórico. Tudo
é escopado por `user_id`, resolvido a partir do header `X-User-Id`.

```
curl -H 'X-User-Id: ana' http://localhost:3001/api/conversations/current
```

Sem o header, os endpoints de conversa e de mensagem respondem `401`.

> ⚠️ **`X-User-Id` não é autenticação.** O Core confia no valor cru do header:
> qualquer cliente pode enviar o que quiser e impersonar outro usuário. Em um
> ambiente com usuários reais, coloque um proxy/gateway na frente do Core que
> valide um token (JWT, sessão, mTLS) e reescreva `X-User-Id` com o subject
> autenticado. Não exponha o Core diretamente. Ver
> `src/middleware/identity.ts`.

## Estrutura

```
src/
├── index.ts                    # Servidor principal com o wiring dos endpoints
├── db/
│   ├── client.ts               # Pool Postgres + cliente Drizzle (conexão preguiçosa)
│   └── schema.ts               # Tabelas conversations, messages e suggestions
├── middleware/
│   └── identity.ts             # Resolve X-User-Id → contexto (401 se ausente)
├── models/
│   ├── message.ts              # Modelo de mensagem (entrada da interface)
│   ├── conversation.ts         # Modelo de conversa + máquina de estados
│   ├── suggestion.ts           # Modelo de sugestão + leitura/validação
│   └── chat-config.ts          # Modelo de configuração + defaults/validação
├── repositories/
│   ├── conversation-repository.ts  # Único acesso às conversas, sempre por usuário
│   └── suggestion-repository.ts    # Único acesso às sugestões, sempre por usuário
├── routes/
│   ├── messages.ts             # POST /api/messages
│   ├── conversations.ts        # Endpoints de conversa
│   └── suggestions.ts          # GET|POST|DELETE /api/suggestions
└── services/
    └── mia-ai.ts               # Integração com a Mia AI (monta o contexto)

local/                         # Harness de teste (git-ignored, ver abaixo)
drizzle/                        # Migrations geradas
drizzle.config.ts
.env.example
```

## Instalação

```bash
npm install
cp .env.example .env   # ajuste a DATABASE_URL
```

## Banco de dados

A conversa é storeada no Postgres via Drizzle ORM.

```bash
npm run db:migrate    # aplica as migrations
npm run db:generate   # gera migration a partir de src/db/schema.ts
npm run db:push       # sincroniza o schema direto, sem migration
npm run db:studio     # abre o Drizzle Studio
```

## Execução

```bash
# Modo desenvolvimento (com hot reload)
npm run dev

# Build para produção
npm run build

# Executar versão de produção
npm start
```

O servidor inicia na porta `3001` por padrão. Para alterar, defina a variável de ambiente `CORE_PORT`.

## Endpoints

### Health Check

```
GET /
```

```json
{
  "status": "ok",
  "service": "chat-mia-core",
  "database": "up"
}
```

Com o Postgres fora do ar o servidor continua no ar e responde `status: "degraded"`, `database: "down"` — o pool de conexões é preguiçoso. O health check não exige identidade.

### Conversa atual

```
GET /api/conversations/current
```

Entrega a conversa em andamento, seu estado e o histórico **daquele usuário**. Cria a conversa automaticamente na primeira chamada, então a interface nunca recebe `404`.

```json
{
  "success": true,
  "data": {
    "id": "9f1c2a44-...",
    "state": "idle",
    "messages": ["..."],
    "active_conversation": { "...": "..." },
    "history": ["..."]
  }
}
```

Otros endpoints de conversa:

| Método | Rota                         | Descrição                             |
| ------ | ---------------------------- | ------------------------------------- |
| `GET`  | `/api/conversations/current` | Conversa atual + histórico do usuário |
| `GET`  | `/api/conversations/active`  | Só a conversa ativa, sem histórico    |
| `POST` | `/api/conversations/rotate`  | Encerra a atual e inicia outra        |

Formato completo em [`docs/core/Conversation.md`](../../docs/core/Conversation.md).

### Enviar Mensagem

```
POST /api/messages
```

Exige `X-User-Id`. A mensagem entra na conversa ativa **de quem enviou**, e o
contexto montado para a Mia AI é o daquele usuário.

**Request Body:**

```json
{
  "message_id": "msg-123",
  "message": "Olá, como vai?",
  "date": "2026-09-18T10:30:00.000Z",
  "metadata": "info adicional",
  "origin": "frontend",
  "config": {
    "language": "pt-BR",
    "tone": "informal",
    "response_length": "short"
  }
}
```

`config` é opcional: é a configuração que a interface escolheu na tela (idioma,
tom, tamanho da resposta) e que o Core repassa para a Mia AI sem interpretar.

**Response (200):**

```json
{
  "success": true,
  "data": {
    "message_id": "msg-123",
    "mia_ai_response": "[Mia AI] Mensagem msg-123 recebida.",
    "suggestions": [{ "suggestion_id": "sg-1", "text": "Ver meu agendamento" }],
    "config": {
      "language": "pt-BR",
      "tone": "informal",
      "response_length": "short"
    }
  }
}
```

`suggestions` vem junto para a interface renderizar as chips sem uma segunda
chamada. São as sugestões que a Mia AI devolveu com a resposta, já gravadas na
conversa — quando ela não devolve nenhuma, o campo traz o que já estava lá.

`config` é a configuração **efetiva**: a que foi repassada, com o que faltava
preenchido pelo default. A interface mostra o que vale sem precisar reproduzir
os defaults.

**Response (400/500/502):**

```json
{
  "success": false,
  "error": "Campos obrigatórios faltando: message_id, message, origin"
}
```

`config` inválido também é `400`, dizendo o campo e os valores aceitos — e sem
gravar a mensagem nem chamar a Mia AI:

```json
{
  "success": false,
  "error": "config.tone deve ser um de: formal, neutral, informal"
}
```

Formato completo em [`docs/core/Message.md`](../../docs/core/Message.md) e
[`docs/core/ChatConfig.md`](../../docs/core/ChatConfig.md).

### Sugestões

```
GET    /api/suggestions
POST   /api/suggestions
DELETE /api/suggestions
```

Sugestão é a ação que a interface oferece abaixo da última resposta da Mia AI:
clicar envia o `text` como mensagem. São só dois campos, `suggestion_id` e
`text`.

Quem **escreve** é a Mia AI (repassada por `POST /api/messages`, que já conhece a
conversa) e a interface, via `POST`. Quem **lê** é a interface, via `GET`.

```json
{
  "success": true,
  "data": {
    "suggestions": [{ "suggestion_id": "sg-1", "text": "Ver meu agendamento" }]
  }
}
```

A cada resposta da Mia AI as sugestões são substituídas pelas novas — o contexto
mudou, e uma chip desatualizada levaria o usuário a pedir algo que a Mia AI já
respondeu. `POST` é o contrário: acrescenta ao fim, sem apagar o que já estava.

Tudo é escopado por `X-User-Id`, como a conversa. Rotacionar a conversa
(`POST /api/conversations/rotate`) começa uma lista nova, e a antiga vai embora
junto com a conversa.

Formato completo em [`docs/core/Suggestion.md`](../../docs/core/Suggestion.md).

## Mia AI

> **O Core não sabe o que é um modelo de linguagem.** Provider, modelo, prompt,
> temperatura e o formato de requisição de qualquer API de IA vivem no servidor
> da Mia AI (`apps/packages/mia-ai`). O Core conhece apenas o contrato HTTP
> abaixo.
>
> A consequência prática: nenhuma credencial de modelo é passada ao Core, e
> trocar de provider não toca este repositório.

O Core monta o contexto a cada envio e faz `POST $MIA_AI_ENDPOINT` com
`{ message, context, config }`.

### Contrato

**Requisição:**

```json
{
  "message": { "message_id": "m1", "message": "Olá", "origin": "frontend" },
  "context": {
    "conversation_id": "9f1c2a44-...",
    "state": "idle",
    "previous_messages": [
      { "message_id": "m0", "message": "oi", "role": "user" }
    ],
    "history_ids": ["8ad9f590-..."],
    "max_context_messages": 20
  },
  "config": {
    "language": "pt-BR",
    "tone": "neutral",
    "response_length": "standard"
  }
}
```

**Resposta (`200`):**

```json
{
  "response": "Olá! Como posso ajudar?",
  "suggestions": [{ "text": "Ver meu agendamento" }]
}
```

Só isso. A conversa não é enviada, e o Core não interpreta nada além do texto de
`response` e da lista de sugestões. O envelope `success`/`data` do próprio Core
também é aceito como alternativa, para um servidor feito à mão não ter que
acertar o formato.

`suggestions` é **opcional**, e o `suggestion_id` dentro dela também: quando
falta, o Core gera. Cada item pode ser `{ "text": "..." }` ou a string do texto
direto. Uma resposta sem o campo preserva as sugestões que já estavam na
conversa; `suggestions: []` limpa. Ver
[Suggestion.md](../../docs/core/Suggestion.md#substituição-vs-preservação).

`config` é a configuração que a interface pediu para esta mensagem — idioma, tom
e tamanho da resposta. Vai no topo, e não dentro do `context`, porque não é
estado da conversa: é o que a tela mandou agora. O Core repassa sem interpretar,
preenchendo o que faltar com o default; quem decide o que fazer com as etiquetas
é a Mia AI, e um servidor que não conhece o campo pode ignorá-lo. Ver
[ChatConfig.md](../../docs/core/ChatConfig.md).

### O contexto é o que dá consciência

A mensagem atual **não** entra em `previous_messages`: o contexto é montado
antes de a mensagem ser persistida, para que ela não apareça como histórico de
si mesma.

Em conversas longas só as `max_context_messages` mais recentes vão — o histórico
completo estouraria a janela de contexto da IA. Os ids de conversas anteriores
vêm em `history_ids`: a Mia AI fica ciente de que houve diálogos antes, sem
receber o conteúdo deles.

O log do servidor mostra o que foi anexado a cada envio, que é a forma mais
rápida de conferir que a consciência de contexto está funcionando:

```
[Mia AI] m2 → http://localhost:3002/api/chat (conversa 6e0cbf75-..., 2 mensagens de contexto, 1 conversas anteriores, config pt-BR · neutral · standard, 2 sugestões)
```

### Quando a Mia AI falha

O Core não sabe se a causa foi chave inválida, limite de taxa ou modelo fora de
ciclo de vida — ele só sabe que o outro lado não respondeu. O que ele faz é
preservar a causa e devolvê-la, para que a interface possa oferecer retry com
sentido:

```json
HTTP 502
{ "success": false, "error": "Mia AI respondeu com erro: Authorization failed" }
```

`502` significa que o Core funcionou e o serviço do qual ele depende não. Um
`500` continua significando falha no próprio Core.

## Máquina de estados

O `state` da conversa governa o que a interface renderiza.

| Estado     | Significado                                                  |
| ---------- | ------------------------------------------------------------ |
| `greeting` | Conversa recém-criada. Mostrar a mensagem de abertura.       |
| `idle`     | Pronta para uma nova mensagem.                               |
| `thinking` | Mensagem enviada, aguardando a Mia AI. Mostrar carregamento. |
| `error`    | A última operação falhou. Oferecer retry.                    |

O Core aplica as transições sozinho conforme o resultado do envio para a Mia AI.

## Variáveis de Ambiente

| Variável               | Descrição                                 | Padrão          |
| ---------------------- | ----------------------------------------- | --------------- |
| `CORE_PORT`            | Porta do servidor                         | `3001`          |
| `DATABASE_URL`         | Conexão Postgres que storeia as conversas | — (obrigatória) |
| `MIA_AI_ENDPOINT`      | Endpoint do **servidor** da Mia AI        | — (obrigatória) |
| `MIA_AI_SERVICE_TOKEN` | Autenticação da chamada entre serviços    | — (opcional)    |
| `MIA_AI_TIMEOUT_MS`    | Tempo máximo de espera pela Mia AI        | `60000`         |

Nenhuma delas é nova na feature de sugestão: a sugestão não muda a forma como o
Core fala com a Mia AI, só o que ele aceita de volta.

## Testar sem a Mia AI

A pasta `local/` traz um harness de desenvolvimento **git-ignored**: um servidor
que faz o papel da Mia AI (com o backend da Nvidia), um REPL de terminal e um
smoke test. Ele existe para testar o Core sem a Mia AI de verdade e sem a
interface.

```bash
npm run stub    # Mia AI falsa, em :3002
npm run repl    # REPL de terminal contra o Core
npm run smoke   # checagem ponta a ponta, sem interação
```

O `README.md` da pasta tem o passo a passo. A pasta não é versionada porque
guarda a `NVIDIA_API_KEY` e porque é ferramenta de quem está mexendo no Core, não
parte do produto — em uma máquina sem ela, os scripts avisam em vez de falhar
com um stack trace.

## Documentação

| Documento                                                      | Conteúdo                                                         |
| -------------------------------------------------------------- | ---------------------------------------------------------------- |
| [`docs/core/Conversation.md`](../../docs/core/Conversation.md) | Modelo de conversa, endpoints, persistência e contexto da Mia AI |
| [`docs/core/Message.md`](../../docs/core/Message.md)           | Modelo de mensagem e endpoint de envio                           |
| [`docs/core/Suggestion.md`](../../docs/core/Suggestion.md)     | Modelo de sugestão, endpoints e limites                          |
| [`docs/core/ChatConfig.md`](../../docs/core/ChatConfig.md)     | Modelo de configuração e o repasse para a Mia AI                 |
