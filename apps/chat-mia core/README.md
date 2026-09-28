# Chat Mia Core

O Core do Chat Mia é responsável por:

- Receber mensagens da interface e repassá-las para a Mia AI.
- Entregar a conversa atual para a interface.
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
│   └── schema.ts               # Tabelas conversations e messages
├── middleware/
│   └── identity.ts             # Resolve X-User-Id → contexto (401 se ausente)
├── models/
│   ├── message.ts              # Modelo de mensagem (entrada da interface)
│   └── conversation.ts         # Modelo de conversa + máquina de estados
├── repositories/
│   └── conversation-repository.ts  # Único acesso às conversas, sempre por usuário
├── routes/
│   ├── messages.ts             # POST /api/messages
│   └── conversations.ts        # Endpoints de conversa
└── services/
    └── mia-ai.ts               # Integração com a Mia AI (monta o contexto)

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
  "origin": "frontend"
}
```

**Response (200):**

```json
{
  "success": true,
  "data": {
    "message_id": "msg-123",
    "mia_ai_response": "[Mia AI] Mensagem msg-123 recebida."
  }
}
```

**Response (400/500/502):**

```json
{
  "success": false,
  "error": "Campos obrigatórios faltando: message_id, message, origin"
}
```

Formato completo em [`docs/core/Message.md`](../../docs/core/Message.md).

## Mia AI

> **O Core não sabe o que é um modelo de linguagem.** Provider, modelo, prompt,
> temperatura e o formato de requisição de qualquer API de IA vivem no servidor
> da Mia AI (`apps/packages/mia-ai`). O Core conhece apenas o contrato HTTP
> abaixo.
>
> A consequência prática: nenhuma credencial de modelo é passada ao Core, e
> trocar de provider não toca este repositório.

O Core monta o contexto a cada envio e faz `POST $MIA_AI_ENDPOINT` com
`{ message, context }`.

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
  }
}
```

**Resposta (`200`):**

```json
{ "response": "Olá! Como posso ajudar?" }
```

Só isso. A conversa não é enviada, e o Core não interpreta nada além do texto de
`response`. O envelope `success`/`data` do próprio Core também é aceito como
alternativa, para um servidor feito à mão não ter que acertar o formato.

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
[Mia AI] m2 → http://localhost:3002/api/chat (conversa 6e0cbf75-..., 2 mensagens de contexto, 1 conversas anteriores)
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

## Documentação

| Documento                                                      | Conteúdo                                                         |
| -------------------------------------------------------------- | ---------------------------------------------------------------- |
| [`docs/core/Conversation.md`](../../docs/core/Conversation.md) | Modelo de conversa, endpoints, persistência e contexto da Mia AI |
| [`docs/core/Message.md`](../../docs/core/Message.md)           | Modelo de mensagem e endpoint de envio                           |
