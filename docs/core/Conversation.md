## Modelo de Conversation

Esse documento trata de como deve ser formatada a conversa atual que o Core entrega para a interface, e de como ela é armazenada.

> **A conversa NÃO é enviada para a Mia AI.**
> A conversa é estado interno do Core, persistido no Postgres. Apenas as mensagens saem do Core. A cada nova mensagem, o Core monta o contexto (mensagens anteriores + ids do histórico) e o envia junto com a mensagem, para que a Mia AI tenha consciência do diálogo sem nunca ver a conversa como objeto.

#### O que é a conversation?

É o retrato completo do que a interface precisa para renderizar a tela de chat: a conversa em andamento, o estado atual da máquina de estados e as conversas anteriores.

Diferente da `message`, que é enviada para a Mia AI, a `conversation` é **lida** pela interface e **guardada** pelo Core. Ela nunca atravessa a fronteira do Core.

---

## Identidade e multi-usuário

Toda conversa pertence a um usuário. Cada um tem a sua própria conversa ativa e o seu próprio histórico; um usuário nunca vê nem afeta a conversa de outro.

### O header `X-User-Id`

A identidade chega no header `X-User-Id` e é resolvida pelo middleware em `src/middleware/identity.ts`. **Todos os endpoints de conversa e de mensagem exigem o header** — sem ele a resposta é `401`, antes de qualquer acesso ao banco.

```bash
curl -H 'X-User-Id: ana' http://localhost:3001/api/conversations/current
```

Formato aceito: de 1 a 64 caracteres, casando com `[A-Za-z0-9._:|+@-]`. Isso cobre ids opacos (`u_123`), emails e subjects de provedores de identidade, que costumam usar `|` como separador (`auth0|abc123`).

### ⚠️ Isto não é autenticação

> O Core confia no **valor cru** do header. Qualquer cliente pode enviar o que quiser e impersonar qualquer outro usuário. O que existe aqui é uma _fronteira de identidade_, não uma barreira de segurança.

Para um ambiente com usuários reais, é preciso um proxy ou gateway na frente do Core que:

1. Valide um token real (JWT, sessão, mTLS).
2. Reescreva `X-User-Id` com o subject autenticado.
3. Remova o header que veio do cliente.

O Core não deve ser exposto diretamente nesse cenário. O contrato de identidade foi isolado em `src/middleware/identity.ts` justamente para que essa troca aconteça em um único lugar — nada mais no Core lê identidade.

### O que o Core garante hoje

Com a identidade resolvida, o isolamento é garantido em três camadas:

| Garantia                                                   | Onde                                                     |
| ---------------------------------------------------------- | -------------------------------------------------------- |
| Nenhum método do repositório pode ser chamado sem `userId` | `conversation-repository.ts`, `suggestion-repository.ts` |
| Toda query filtra por `user_id`                            | `conversation-repository.ts`                             |
| No máximo uma conversa ativa **por usuário**               | índice único no Postgres                                 |

Isso cobre os efeitos colaterais: um erro no envio de um usuário muda o `state` da conversa **dele** apenas, e um `rotate` encerra **a sua** conversa, não a de ninguém mais. As sugestões herdam o mesmo escopo pela conversa — ver [Suggestion.md](./Suggestion.md#identidade-e-multi-usuário).

---

## Endpoints

### `GET /api/conversations/current`

Entrega a conversa atual **do usuário** para a interface.

**URL completa:** `http://localhost:3001/api/conversations/current`

Cria a conversa automaticamente na primeira chamada, de modo que a interface nunca receba `404` e possa renderizar a tela de abertura sem um passo de "criar" separado.

#### Response Codes

| Código | Descrição                                      |
| ------ | ---------------------------------------------- |
| `200`  | Conversa atual entregue com sucesso            |
| `401`  | `X-User-Id` ausente ou inválido                |
| `500`  | Erro interno (banco indisponível, por exemplo) |

#### Response Body (200)

```json
{
  "success": true,
  "data": {
    "id": "9f1c2a44-...",
    "state": "idle",
    "messages": [
      {
        "message_id": "msg-1",
        "message": "Olá, qual meu nome?",
        "date": "2026-09-28T16:38:38.643Z",
        "origin": "frontend",
        "role": "user"
      },
      {
        "message_id": "msg-1-mia",
        "message": "Você se chama Ana.",
        "date": "2026-09-28T16:38:38.660Z",
        "origin": "mia-ai",
        "role": "mia"
      }
    ],
    "active_conversation": {
      "id": "9f1c2a44-...",
      "state": "idle",
      "messages": ["..."],
      "created_at": "2026-09-28T16:38:29.927Z",
      "updated_at": "2026-09-28T16:38:38.893Z"
    },
    "history": [
      {
        "id": "4d3e913d-...",
        "state": "idle",
        "messages": ["..."],
        "created_at": "2026-09-27T10:00:00.000Z",
        "updated_at": "2026-09-27T10:04:12.000Z"
      }
    ]
  }
}
```

#### Response Body (500)

```json
{
  "success": false,
  "error": "Erro interno ao obter a conversa atual"
}
```

---

### `GET /api/conversations/active`

Variante enxuta de `/current`: devolve **apenas** a conversa ativa, sem o `history`. Use quando a interface já mantém o histórico em memória e só precisa sincronizar a conversa em andamento.

| Código | Descrição                           |
| ------ | ----------------------------------- |
| `200`  | Conversa ativa entregue com sucesso |
| `401`  | `X-User-Id` ausente ou inválido     |
| `500`  | Erro interno                        |

```json
{
  "success": true,
  "data": {
    "id": "9f1c2a44-...",
    "state": "idle",
    "messages": ["..."],
    "created_at": "2026-09-28T16:38:29.927Z",
    "updated_at": "2026-09-28T16:38:38.893Z"
  }
}
```

---

### `POST /api/conversations/rotate`

Encerra a conversa em andamento **do usuário** — que passa a integrar o `history` dele — e cria uma nova conversa ativa, já no estado `greeting`. Não afeta a conversa de nenhum outro usuário.

| Código | Descrição                        |
| ------ | -------------------------------- |
| `200`  | Nova conversa criada com sucesso |
| `401`  | `X-User-Id` ausente ou inválido  |
| `500`  | Erro interno                     |

```json
{
  "success": true,
  "data": {
    "id": "ee809cb9-...",
    "state": "greeting",
    "messages": [],
    "created_at": "2026-09-28T16:40:00.000Z",
    "updated_at": "2026-09-28T16:40:00.000Z"
  }
}
```

---

## Estrutura

### `ConversationView`

Corpo de `GET /api/conversations/current`.

| Campo                 | Tipo                    | Descrição                                                          |
| --------------------- | ----------------------- | ------------------------------------------------------------------ |
| `id`                  | `string`                | Atalho para `active_conversation.id`.                              |
| `state`               | `ConversationState`     | Atalho para `active_conversation.state`.                           |
| `messages`            | `ConversationMessage[]` | Atalho para `active_conversation.messages`.                        |
| `active_conversation` | `Conversation`          | A conversa em andamento. Sempre presente.                          |
| `history`             | `Conversation[]`        | Conversas anteriores **dele**, da mais recente para a mais antiga. |

Os atalhos (`id`, `state`, `messages`) existem para que a interface renderize a tela sem navegar a estrutura aninhada. **São cópias, não referências** — no JSON eles aparecem duplicados, e o cliente deve alterar apenas `active_conversation` e recarregar a visão.

### `Conversation`

| Campo        | Tipo                    | Descrição                           |
| ------------ | ----------------------- | ----------------------------------- |
| `id`         | `string`                | Identifica a conversa.              |
| `state`      | `ConversationState`     | Estado atual da máquina de estados. |
| `messages`   | `ConversationMessage[]` | Mensagens em ordem cronológica.     |
| `created_at` | `string`                | Data de criação. ISO 8601.          |
| `updated_at` | `string`                | Data da última alteração. ISO 8601. |

Existe **exatamente uma** conversa ativa no Core. Todas as demais formam o `history`.

### `ConversationMessage`

Estende o modelo `Message` de `docs/core/Message.md` com um único campo.

| Campo        | Tipo              | Descrição                  |
| ------------ | ----------------- | -------------------------- |
| `message_id` | `string`          | Identifica a mensagem.     |
| `message`    | `string`          | Conteúdo da mensagem.      |
| `date`       | `string`          | Data. ISO 8601.            |
| `metadata`   | `string?`         | Metadata sobre a mensagem. |
| `origin`     | `string`          | Origem da mensagem.        |
| `role`       | `"user" \| "mia"` | Quem produziu a mensagem.  |

`role` é atribuído pelo Core ao persistir. O contrato de **entrada** `POST /api/messages` permanece inalterado: a interface não envia `role`.

### `ConversationState`

Máquina de estados do chat.

| Estado     | Significado para a interface                                                                        |
| ---------- | --------------------------------------------------------------------------------------------------- |
| `greeting` | Conversa recém-criada, sem interação. Mostrar a mensagem de abertura (ex.: _"Como posso ajudar?"_). |
| `idle`     | Pronta para o usuário enviar uma nova mensagem.                                                     |
| `thinking` | Mensagem enviada, resposta da Mia AI ainda não chegou. Mostrar o indicador de carregamento.         |
| `error`    | A última operação falhou. Oferecer retry.                                                           |

Transições permitidas:

```
greeting ──► idle ──► thinking ──► idle
                │          │
                │          └──────► error
                └─────────────────► error
error ──► idle  |  error ──► greeting  |  idle ──► greeting
```

O Core aplica as transições sozinho conforme o resultado do envio para a Mia AI. A interface apenas reage ao `state` recebido.

---

## Persistência

A conversa é storeada no Postgres, via Drizzle ORM.

### Tabelas

**`conversations`**

| Coluna       | Tipo          | Observação                               |
| ------------ | ------------- | ---------------------------------------- |
| `id`         | `text`        | Primary key.                             |
| `user_id`    | `text`        | Dono da conversa. `NOT NULL`.            |
| `state`      | `text`        | `ConversationState`. Default `greeting`. |
| `is_active`  | `boolean`     | Default `false`.                         |
| `created_at` | `timestamptz` | Default `now()`.                         |
| `updated_at` | `timestamptz` | Default `now()`.                         |

**`messages`**

| Coluna            | Tipo          | Observação                                       |
| ----------------- | ------------- | ------------------------------------------------ |
| `conversation_id` | `text`        | FK para `conversations.id`, `ON DELETE CASCADE`. |
| `message_id`      | `text`        | Id da mensagem. **Único só dentro da conversa.** |
| `role`            | `text`        | `user` ou `mia`.                                 |
| `content`         | `text`        | Conteúdo da mensagem.                            |
| `origin`          | `text`        | Origem.                                          |
| `metadata`        | `text`        | Opcional.                                        |
| `date`            | `timestamptz` | Default `now()`.                                 |

A chave primária de `messages` é o par `(conversation_id, message_id)`.

**`suggestions`**

| Coluna            | Tipo          | Observação                                       |
| ----------------- | ------------- | ------------------------------------------------ |
| `conversation_id` | `text`        | FK para `conversations.id`, `ON DELETE CASCADE`. |
| `suggestion_id`   | `text`        | Id da sugestão. **Único só dentro da conversa.** |
| `text`            | `text`        | Texto exibido e enviado como mensagem ao clicar. |
| `position`        | `integer`     | Ordem sugerida pela Mia AI. `0` é a primeira.    |
| `date`            | `timestamptz` | Default `now()`.                                 |

A chave primária de `suggestions` é o par `(conversation_id, suggestion_id)`, pelo mesmo motivo da de `messages`. A tabela não tem `user_id`: o escopo vem da conversa. Detalhes em [Suggestion.md](./Suggestion.md#persistência).

### Integridade garantida no banco

Três invariantes são impostas pelo Postgres, e não apenas pela aplicação:

- **No máximo uma conversa ativa por usuário.** O índice parcial único `conversations_user_single_active_idx` cobre apenas as linhas com `is_active = true` e usa o par `(user_id, is_active)` como chave. Usuários distintos não colidem, porque o `user_id` faz parte da chave; o mesmo usuário, ao tentar abrir uma segunda conversa ativa, recebe violação de unicidade. Duas requisições simultâneas do mesmo usuário são tratadas pelo Core, que devolve a conversa vencedora.
- **`message_id` único apenas dentro da conversa.** Graças à chave composta, dois usuários podem usar o mesmo `message_id` (`msg-1`) em conversas diferentes, e reenviar a mesma mensagem na mesma conversa continua sendo um no-op — o que torna o envio idempotente.
- **`role` fechado em `user | mia`.** A constraint `messages_role_check` rejeita qualquer outro valor.

### Configuração

```bash
# 1. Variáveis de ambiente (ver .env.example)
DATABASE_URL=postgresql://USER:PASSWORD@localhost:5432/omnia

# 2. Aplicar as migrations
npm run db:migrate

# 3. Rodar o Core
npm run dev
```

Scripts disponíveis: `db:generate`, `db:migrate`, `db:push`, `db:studio`.

### Comportamento sem banco

O pool de conexões é preguiçoso: o Core sobe e responde ao health check mesmo com o Postgres indisponível.

| Situação                    | Resposta                                                    |
| --------------------------- | ----------------------------------------------------------- |
| Banco fora do ar            | `GET /` → `{"status":"degraded","database":"down"}`         |
| Banco fora do ar            | `GET /api/conversations/current` → `500`                    |
| `DATABASE_URL` não definida | `500` nos endpoints de conversa; health check em `degraded` |

O servidor não reinicia sozinho quando o banco volta; a próxima requisição reconecta via pool.

A ausência de `X-User-Id` é independente do banco: responde `401` sem tocar o Postgres, já que a identidade é validada no middleware.

---

## Integração com a Mia AI

### Divisão de responsabilidades

```
Interface                 Core                          provider da Mia AI
   │                        │                                  │
   │ GET /conversations/    │                                  │
   │ current                │                                  │
   │───────────────────────►│  lê do Postgres                  │
   │◄───────────────────────│  (NÃO vai para a Mia AI)         │
   │                        │                                  │
   │ POST /messages         │                                  │
   │ { message, config }    │                                  │
   │───────────────────────►│  grava msg na conversa           │
   │                        │  monta o contexto                │
   │                        │─────────────────────────────────►│
   │                        │  { message, context, config }    │
   │                        │◄─────────────────────────────────│
   │◄───────────────────────│  grava a resposta (role: "mia")  │
```

**A conversa não sai do Core.** A única coisa que atravessa a fronteira é o trio `{ message, context, config }` montado por `src/services/mia-ai/`: a mensagem nova, a fatia mínima do diálogo e a configuração que a interface pediu. O `config` não vem da conversa — vem do cliente, e vale só para este envio. Ver [ChatConfig.md](./ChatConfig.md).

O contexto é montado a partir da conversa **do usuário que enviou a mensagem**. Nenhum histórico de outro usuário é lido para construir esse payload.

### `MiaAIContext`

O contexto não é a conversa: é a fatia mínima que a Mia AI precisa para estar ciente do diálogo.

| Campo                  | Tipo                    | Descrição                                                   |
| ---------------------- | ----------------------- | ----------------------------------------------------------- |
| `conversation_id`      | `string`                | Id da conversa ativa.                                       |
| `state`                | `ConversationState`     | Estado no momento do envio.                                 |
| `previous_messages`    | `ConversationMessage[]` | Mensagens **anteriores** da conversa, em ordem cronológica. |
| `history_ids`          | `string[]`              | Ids das conversas anteriores, mais recente primeiro.        |
| `max_context_messages` | `number`                | Janela de contexto aplicada (default `20`).                 |

A mensagem atual **não** entra em `previous_messages`: o contexto é montado antes de a mensagem ser persistida, para que ela não apareça como histórico de si mesma.

Em conversas longas, só as `max_context_messages` mensagens mais recentes são enviadas — o histórico completo estouraria a janela de contexto da IA.

### Sem estado na Mia AI

A Mia AI não guarda conversa. Todo o histórico é reconstruído pelo Core a partir do Postgres no momento de cada envio. Consequência: ela responde com consciência do diálogo, mas uma queda do Core não perde nada, porque o estado nunca esteve nela.

A mesma coisa vale para a configuração: o `config` do envio é um despacho, não estado. Ele não é storeado, não sobrevive à mensagem seguinte e não volta em nenhum endpoint de conversa. Ver [ChatConfig.md](./ChatConfig.md).

### A fronteira: o Core não sabe o que é IA

O Core não conhece provider, modelo, prompt nem formato de requisição de
nenhuma API de IA. Isso mora atrás da interface `AIProvider`, em
`src/services/mia-ai/providers/`. O Core monta o contexto e chama o provider;
quem decide como gerar o texto é o outro lado da interface.

O provider roda dentro do processo do Core — a Mia AI não é mais um serviço
separado, e não há mais `MIA_AI_ENDPOINT` para configurar. Isso muda o
transporte, não a fronteira: o provider continua sem conhecer rotas, conversa,
sugestões ou banco, e o Core continua sem conhecer provider.

O mesmo vale para as opções que a interface escolhe: idioma, tom e tamanho
chegam como etiquetas e saem como etiquetas. O Core valida o formato, não o
significado — ele sabe o que `formal` quer dizer na tela, e o que isso vira no
modelo é do provider.

Falar de "a Mia AI tem consciência do contexto" não significa que o Core integra
um modelo: significa que o Core reconstrói, a cada envio, tudo o que a IA
precisa para não começar do zero — e ela não precisa guardar nada.

Na prática, o contrato é `AIProvider.respond({ message, context, config })` com
`{ "response": "...", "suggestions": [...] }` de volta. Ver
[Message.md](./Message.md#contrato-com-o-provider-da-mia-ai).

Falhas do provider viram `502` com a causa preservada, em vez de um `500`
genérico. O tempo de espera é do provider, e é folgado o bastante para uma
geração longa: o modelo escreve token a token, e cortar cedo devolvia erro no
meio da digitação. Ver
[Tempo de espera pelo modelo](./Message.md#tempo-de-espera-pelo-modelo).

### TODO

- [ ] Retry com backoff quando o provider da Mia AI responde `502`
- [ ] Streaming da resposta, para a Mia AI aparecer token a token
- [ ] Circuit breaker para o provider (hoje só há timeout)
- [ ] Resumo automático de conversas longas em vez de truncamento
- [ ] Autenticação de verdade: validar token e derivar `user_id` de um subject, em vez de confiar no header
