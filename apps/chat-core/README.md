# Chat Core

O Core do chat é responsável por:

- Receber mensagens da interface e repassá-las para a AI.
- Repassar para a AI a configuração que a interface escolheu (idioma, tom,
  tamanho da resposta), preenchendo o que faltar com o default.
- Entregar a conversa atual para a interface.
- Entregar e registrar as sugestões da conversa atual.
- Guardar a conversa internamente, no Postgres.

> **A conversa nunca é enviada para a AI.** Ela é estado interno do Core.
> Apenas as mensagens saem do Core — e cada envio carrega o contexto do diálogo
> para que a AI tenha consciência do histórico.
>
> A AI roda **dentro do Core**, atrás da interface `AIProvider`. O provider
> em uso é um substituto temporário de teste. Ver [AI](#ai).

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
    └── ai/
        ├── index.ts            # API pública (buildContext, sendToAI)
        ├── context.ts          # Montagem do contexto da conversa
        ├── provider.ts         # Interface AIProvider + registro
        ├── prompt.ts           # config → prompt de chat
        └── providers/
            ├── nvidia.ts       # Substituto de teste (Nvidia)
            └── echo.ts         # Texto fixo, sem chamar modelo

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
  "service": "chat-ai-core",
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
contexto montado para a AI é o daquele usuário.

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
tom, tamanho da resposta) e que o Core repassa para a AI sem interpretar.

**Response (200):**

```json
{
  "success": true,
  "data": {
    "message_id": "msg-123",
    "ai_response": "[AI] Mensagem msg-123 recebida.",
    "suggestions": [{ "suggestion_id": "sg-1", "text": "Ver meus detalhes" }],
    "config": {
      "language": "pt-BR",
      "tone": "informal",
      "response_length": "short"
    }
  }
}
```

`suggestions` vem junto para a interface renderizar as chips sem uma segunda
chamada. São as sugestões que a AI devolveu com a resposta, já gravadas na
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
gravar a mensagem nem chamar a AI:

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

Sugestão é a ação que a interface oferece abaixo da última resposta da AI:
clicar envia o `text` como mensagem. São só dois campos, `suggestion_id` e
`text`.

Quem **escreve** é a AI (repassada por `POST /api/messages`, que já conhece a
conversa) e a interface, via `POST`. Quem **lê** é a interface, via `GET`.

```json
{
  "success": true,
  "data": {
    "suggestions": [{ "suggestion_id": "sg-1", "text": "Ver meus detalhes" }]
  }
}
```

A cada resposta da AI as sugestões são substituídas pelas novas — o contexto
mudou, e uma chip desatualizada levaria o usuário a pedir algo que a AI já
respondeu. `POST` é o contrário: acrescenta ao fim, sem apagar o que já estava.

Tudo é escopado por `X-User-Id`, como a conversa. Rotacionar a conversa
(`POST /api/conversations/rotate`) começa uma lista nova, e a antiga vai embora
junto com a conversa.

Formato completo em [`docs/core/Suggestion.md`](../../docs/core/Suggestion.md).

## AI

> **O Core não sabe o que é um modelo de linguagem.** Provider, modelo, prompt,
> temperatura e o formato de requisição de qualquer API de IA vivem atrás da
> interface `AIProvider`, em `src/services/ai/providers/`.
>
> A consequência prática: rotas, conversa, sugestões e persistência não importam
> nada de provider. Trocar de provider é um arquivo novo e uma linha no registro.

A AI roda **dentro do Core**, no mesmo processo. O provider em uso é um
substituto temporário de teste (`nvidia`), que fala com o backend da Nvidia.

```
Core monta o contexto → AIProvider.respond() → { response, suggestions }
```

### Estrutura

```
src/services/ai/
├── index.ts          API pública: buildContext, sendToAI, AIError
├── context.ts        AIContext e a montagem do contexto
├── provider.ts       interface AIProvider + registro dos providers
├── prompt.ts         { message, context, config } → mensagens de chat
└── providers/
    ├── nvidia.ts     substituto de teste: backend da Nvidia
    └── echo.ts       texto fixo, sem chamar modelo
```

A modularidade aqui é o que torna o provider descartável: ele está confinado a
`providers/`, e nada fora desse diretório importa `nvidia` nem `echo`. Trocá-lo
ou apagá-lo não toca rotas, modelos, repositórios ou banco.

### Contrato

O que o Core entrega ao provider:

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

E o que volta:

```json
{
  "response": "Olá! Como posso ajudar?",
  "suggestions": [{ "suggestion_id": "sg-1", "text": "Ver meus detalhes" }]
}
```

A conversa não é enviada. `suggestions` é **opcional**, e o `suggestion_id`
também: quando falta, o Core gera. Uma resposta sem o campo preserva as
sugestões que já estavam na conversa; `suggestions: []` limpa. Ver
[Suggestion.md](../../docs/core/Suggestion.md#substituição-vs-preservação).

`config` é a configuração que a interface pediu para esta mensagem — idioma, tom
e tamanho da resposta. Vai no topo, e não dentro do `context`, porque não é
estado da conversa: é o que a tela mandou agora. O Core repassa sem interpretar,
preenchendo o que faltar com o default; quem decide o que fazer com as etiquetas
é o provider, e um provider que não conhece o campo pode ignorá-lo. Ver
[ChatConfig.md](../../docs/core/ChatConfig.md).

### O contexto é o que dá consciência

A mensagem atual **não** entra em `previous_messages`: o contexto é montado
antes de a mensagem ser persistida, para que ela não apareça como histórico de
si mesma.

Em conversas longas só as `max_context_messages` mais recentes vão — o histórico
completo estouraria a janela de contexto da IA. Os ids de conversas anteriores
vêm em `history_ids`: o provider fica ciente de que houve diálogos antes, sem
receber o conteúdo deles.

O log do servidor mostra o que foi anexado a cada envio, que é a forma mais
rápida de conferir que a consciência de contexto está funcionando:

```
[Nvidia] 6e0cbf75-... · 2 mensagens de contexto · 1 conversas anteriores · config pt-BR · neutral · standard · 4210ms · 2 sugestões
```

O tempo em ms aparece porque é ele que explica a demora: uma resposta `detailed`
com histórico leva segundos, e isso é o modelo escrevendo, não o Core travado.

### Tempo de espera

A Nvidia **não devolve a resposta pronta**: ela escreve token a token. Uma
resposta longa passa dos 60 s sem que nada esteja errado — e o teto de 60 s que
existia cortava a geração no meio da digitação, devolvendo um erro em vez da
resposta que estava a caminho.

O padrão agora é `NVIDIA_TIMEOUT_MS=300000` (5 min). Ele continua sendo um teto,
porque um provider pendurado precisa virar erro em algum momento, e continua
configurável, porque em teste local um teto menor é melhor que esperar cinco
minutos por um provider que morreu.

### Quando a AI falha

O Core não sabe se a causa foi chave inválida, limite de taxa ou modelo fora de
ciclo de vida — ele só sabe que o provider não respondeu. O que ele faz é
preservar a causa e devolvê-la, para que a interface possa oferecer retry com
sentido:

```json
HTTP 502
{ "success": false, "error": "NVIDIA 401: {\"detail\":\"invalid api key\"}" }
```

`502` significa que o Core funcionou e o provider do qual ele depende não. Um
`500` continua significando falha no próprio Core.

Perder as sugestões não derruba a conversa: se a segunda chamada ao modelo
falhar, a resposta da primeira volta normalmente e as sugestões anteriores
seguem valendo.

## Máquina de estados

O `state` da conversa governa o que a interface renderiza.

| Estado     | Significado                                              |
| ---------- | -------------------------------------------------------- |
| `greeting` | Conversa recém-criada. Mostrar a mensagem de abertura.   |
| `idle`     | Pronta para uma nova mensagem.                           |
| `thinking` | Mensagem enviada, aguardando a AI. Mostrar carregamento. |
| `error`    | A última operação falhou. Oferecer retry.                |

O Core aplica as transições sozinho conforme o resultado do envio para a AI.

## Variáveis de Ambiente

| Variável            | Descrição                                    | Padrão                                |
| ------------------- | -------------------------------------------- | ------------------------------------- |
| `CORE_PORT`         | Porta do servidor                            | `3001`                                |
| `DATABASE_URL`      | Conexão Postgres que storeia as conversas    | — (obrigatória)                       |
| `AI_PROVIDER`       | Provider da AI: `nvidia` ou `echo`           | `nvidia`                              |
| `NVIDIA_API_KEY`    | Chave do backend da Nvidia                   | — (com `nvidia`)                      |
| `NVIDIA_MODEL`      | Modelo de chat do NIM                        | `meta/llama-3.3-70b-instruct`         |
| `NVIDIA_BASE_URL`   | Base do NIM (compatível com a API da OpenAI) | `https://integrate.api.nvidia.com/v1` |
| `NVIDIA_TIMEOUT_MS` | Teto de espera pelo modelo                   | `300000` (5 min)                      |
| `NVIDIA_MAX_TOKENS` | Tokens máximos por resposta                  | `400`                                 |
| `AI_IGNORE_CONFIG`  | `1` = ignora o `config` da interface         | — (opcional)                          |
| `AI_NO_SUGGESTIONS` | `1` = não devolve `suggestions`              | — (opcional)                          |

`NVIDIA_TIMEOUT_MS` é alto de propósito: o modelo escreve token a token, e uma
resposta longa passa dos 60 s. Ver [Tempo de espera](#tempo-de-espera).

## Testar sem a Nvidia

Com `AI_PROVIDER=echo` o Core responde sem chamar modelo nenhum, o fluxo
inteiro é testado e nada de cota é gasto. O eco mostra o `config` entre
parênteses, então esse modo também é o jeito mais barato de conferir o repasse
de configuração.

```bash
AI_PROVIDER=echo npm run dev
```

Com a Nvidia de verdade, é só ter `NVIDIA_API_KEY` no `.env`.

## Harness local

A pasta `local/` traz ferramentas de desenvolvimento **git-ignored**: um REPL de
terminal e um smoke test. Elas exercitam o Core pela interface HTTP, sem
depender do provider.

```bash
npm run repl    # REPL de terminal contra o Core
npm run smoke   # checagem ponta a ponta, sem interação
```

O `README.md` da pasta tem o passo a passo. O servidor da AI falsa que morava
aqui foi para dentro do Core (`src/services/ai/providers/nvidia.ts`), então
não há mais um processo a subir nem endpoint para apontar. A pasta segue
fora do git porque guarda a `NVIDIA_API_KEY` do `local/.env` e porque é
ferramenta de quem está mexendo no Core, não parte do produto.

## Documentação

| Documento                                                      | Conteúdo                                                     |
| -------------------------------------------------------------- | ------------------------------------------------------------ |
| [`docs/core/Conversation.md`](../../docs/core/Conversation.md) | Modelo de conversa, endpoints, persistência e contexto da AI |
| [`docs/core/Message.md`](../../docs/core/Message.md)           | Modelo de mensagem e endpoint de envio                       |
| [`docs/core/Suggestion.md`](../../docs/core/Suggestion.md)     | Modelo de sugestão, endpoints e limites                      |
| [`docs/core/ChatConfig.md`](../../docs/core/ChatConfig.md)     | Modelo de configuração e o repasse para a AI                 |
