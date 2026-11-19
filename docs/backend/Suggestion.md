# Modelo de Suggestion

Esse documento trata de como deve ser formatada a sugestão que o Backend entrega para a interface, e de onde ela vem.

#### O que é a suggestion?

É a ação que a interface oferece abaixo da última resposta da AI. O usuário clica e o texto vai para o input como se ele tivesse digitado.

```json
{ "suggestion_id": "sg-1", "text": "Ver meus detalhes" }
```

Dois campos, e só:

| Campo           | Tipo     | Descrição                                                        |
| --------------- | -------- | ---------------------------------------------------------------- |
| `suggestion_id` | `string` | Identifica a sugestão. Único **dentro da conversa**.             |
| `text`          | `string` | Texto exibido na interface. É o que vai como mensagem ao clicar. |

`suggestion_id` é **único apenas dentro da conversa**, não no banco inteiro: dois usuários podem receber a sugestão `sg-1` ao mesmo tempo.

### Quem escreve e quem lê

```
        POST /api/messages            POST /api/suggestions
AI ───────────────────▶┐   interface ──────────────▶┌──▶ Postgres (suggestions)
                           │                            │
                           ▼        GET /api/suggestions  │
                    ┌──────────────┐◀────────────────────┘
                    │   Backend    │
                    └──────────────┘
```

A produção da sugestão é da **AI** — o Backend não sabe o que é um modelo de linguagem, então não decide o que é uma boa sugestão. O Backend é o meio: guarda o que a AI devolveu, no lugar certo, e entrega o que está guardado.

> **A sugestão sai do Backend, a conversa não.** Assim como as mensagens, as sugestões são estado interno do Backend, e a conversa continua nunca sendo enviada para a AI.

---

## Identidade e multi-usuário

Todo endpoint de sugestão exige JWT OIDC válido no header `Authorization: Bearer`, resolvido pelo middleware em `src/middleware/identity.ts`. Sem token válido, a resposta é `401`, antes de qualquer acesso ao banco.

```bash
curl -H 'Authorization: Bearer <access-token>' http://localhost:3001/api/suggestions
```

A escopo vem da conversa, como nas mensagens:

| Garantia                                             | Onde                             |
| ---------------------------------------------------- | -------------------------------- |
| Todo método do repositório exige `userId`            | `suggestion-repository.ts`       |
| O `conversation_id` nunca vem do corpo da requisição | `suggestion-repository.ts`       |
| Sugestões saem com a conversa, por cascade           | `ON DELETE CASCADE` no Postgres  |
| Rotacionar a conversa começa uma lista nova          | `POST /api/conversations/rotate` |

Um cliente não consegue ler nem escrever as sugestões de outra pessoa, nem passando um id de conversa no corpo da requisição: o repositório resolve a conversa ativa a partir do `userId` e ignora qualquer id informado.

> O `sub` do token verificado determina o usuário. Ver [Identidade e multi-usuário](./Conversation.md#jwt-bearer-e-identidade).

---

## Endpoints

Todos exigem `X-User-Id` e operam apenas nas sugestões da conversa ativa de quem fez a requisição.

| Método   | Rota               | Quem chama                        |
| -------- | ------------------ | --------------------------------- |
| `GET`    | `/api/suggestions` | Interface, ao renderizar as chips |
| `POST`   | `/api/suggestions` | Interface, ao registrar sugestão  |
| `DELETE` | `/api/suggestions` | Interface, ao descartar as chips  |

> **As sugestões que a AI devolve junto de uma resposta não passam por `POST`.** Elas são persistidas por `POST /api/messages`, que já conhece a conversa em que a resposta foi gerada. Ver [Message.md](./Message.md#sugestões-na-resposta).

### `GET /api/suggestions`

Entrega as sugestões da conversa ativa **do usuário**, na ordem em que a AI as sugeriu.

Nunca devolve `404`: se o usuário ainda não conversou, a conversa ativa é criada e a resposta é uma lista vazia — que é o que a interface precisa para não renderizar nada.

| Código | Descrição                                      |
| ------ | ---------------------------------------------- |
| `200`  | Sugestões entregues com sucesso                |
| `401`  | Token Bearer ausente ou inválido               |
| `500`  | Erro interno (banco indisponível, por exemplo) |

**Response Body (200):**

```json
{
  "success": true,
  "data": {
    "suggestions": [
      { "suggestion_id": "sg-1", "text": "Ver meus detalhes" },
      { "suggestion_id": "sg-2", "text": "Falar com o suporte" }
    ]
  }
}
```

A lista vem embrulhada em `data.suggestions`, e não solta no `data`, para o cliente não precisar adivinhar se recebeu uma sugestão ou uma lista delas.

---

### `POST /api/suggestions`

Acrescenta sugestões ao fim da lista da conversa ativa do usuário, **sem apagar** o que já estava lá. É o caminho para a interface registrar uma sugestão que não veio da AI — um atalho, uma ação de tela.

O `suggestion_id` é opcional: quando falta, o Backend gera um (`sg-<uuid>`). O envelope `success`/`data` do próprio Backend é aceito na resposta.

**Request Body** — as duas formas são aceitas:

```json
{ "suggestions": [{ "text": "Ver meus detalhes" }] }
```

```json
{ "text": "Ver meus detalhes" }
```

Nos itens da lista, `{"text": "..."}` e a string do texto direto são equivalentes: `{"suggestions": ["ver meus detalhes"]}` funciona. A mesma tolerância vale para o que a AI devolve.

Ids repetidos dentro da conversa são ignorados: reenviar a mesma requisição não duplica as chips. E a lista da conversa é limitada a 8 — ver [Limites](#limites).

| Código | Descrição                                                        |
| ------ | ---------------------------------------------------------------- |
| `200`  | Sugestões registradas com sucesso                                |
| `400`  | JSON inválido, lista vazia, mais de 8 sugestões ou item inválido |
| `401`  | Token Bearer ausente ou inválido                                 |
| `500`  | Erro interno                                                     |

**Response Body (200):**

```json
{
  "success": true,
  "data": {
    "suggestions": [
      { "suggestion_id": "sg-1", "text": "Ver meus detalhes" },
      { "suggestion_id": "sg-3", "text": "Ver minha conta" }
    ]
  }
}
```

A resposta é a lista inteira da conversa, não só o que foi acrescentado — a interface não precisa de outra chamada para desenhar.

**Response Body (400):**

```json
{
  "success": false,
  "error": "suggestions[0] inválida: use { \"text\": \"...\" } ou a string do texto, com até 500 caracteres"
}
```

O índice entra no erro porque a interface corrige o item, não a lista.

---

### `DELETE /api/suggestions`

Limpa a lista da conversa ativa **do usuário**. É o que a interface chama depois que o usuário clica numa sugestão e envia a mensagem: as chips antigas deixaram de fazer sentido, e a próxima resposta da AI trará as novas.

Nenhuma outra conversa é afetada. Sem sugestões para remover, a resposta é `200` com `deleted: 0` — apagar de uma lista vazia não é erro.

| Código | Descrição                        |
| ------ | -------------------------------- |
| `200`  | Sugestões removidas com sucesso  |
| `401`  | Token Bearer ausente ou inválido |
| `500`  | Erro interno                     |

**Response Body (200):**

```json
{
  "success": true,
  "data": { "deleted": 2 }
}
```

---

## Sugestões na resposta

`POST /api/messages` já devolve as sugestões da conversa em `data.suggestions`, para a interface renderizar as chips sem uma segunda chamada logo depois da resposta.

```json
{
  "success": true,
  "data": {
    "message_id": "msg-123",
    "ai_response": "Você tem consulta amanhã às 14h.",
    "suggestions": [
      { "suggestion_id": "sg-1", "text": "Reagendar" },
      { "suggestion_id": "sg-2", "text": "Falar com o suporte" }
    ]
  }
}
```

### Substituição vs. preservação

A cada resposta da AI, as sugestões são **substituídas** pelas novas. O contexto mudou, e uma chip desatualizada levaria o usuário a pedir algo que a AI já respondeu.

A diferença entre as duas abaixo importa, e vem do contrato com a AI:

| O que a AI devolve              | O que o Backend faz com as sugestões da conversa |
| ------------------------------- | ------------------------------------------------ |
| `suggestions: [...]`            | Substitui pelas novas                            |
| `suggestions: []`               | Limpa — é uma decisão, não uma omissão           |
| campo `suggestions` **ausente** | **Preserva** as que já estavam                   |

A omissão é preservada porque a produção das sugestões é responsabilidade do provider da AI, e um provider que ainda não devolve o campo não deve apagar o que a interface está exibindo. O provider traduz "não produziu lista" para `null` antes de devolver — detalhe em `extractJsonArray`, em `src/services/ai/prompt.ts`.

### Limites

| Limite                        | Valor | Onde                         |
| ----------------------------- | ----- | ---------------------------- |
| Sugestões por conversa        | `8`   | `MAX_SUGGESTIONS`            |
| Caracteres do `text`          | `500` | `MAX_SUGGESTION_TEXT_LENGTH` |
| Caracteres do `suggestion_id` | `128` | `MAX_SUGGESTION_ID_LENGTH`   |

O que excede é tratado assim:

- **Vindo da AI** — as entradas fora do limite são descartadas, em silêncio. Uma sugestão ruim não deve derrubar a resposta que a acompanhou.
- **Vindo da interface (`POST`)** — é `400`, com o índice do item. Quem chamou está esperando uma gravação e precisa saber o que estava errado.

O teto de 8 vale para a **conversa**, não para a requisição. Registrar numa lista cheia descarta as mais antigas, nunca as que acabaram de entrar — a interface está sempre olhando para uma lista do mesmo tamanho, e não pode ver sumir justamente o que ela acabou de mandar.

---

## Persistência

Tabela `suggestions`, com migration em `drizzle/0001_add_suggestions.sql`.

| Coluna            | Tipo                       | Descrição                                         |
| ----------------- | -------------------------- | ------------------------------------------------- |
| `conversation_id` | `text`                     | Conversa dona. FK para `conversations`, cascade   |
| `suggestion_id`   | `text`                     | Id da sugestão. PK composta com `conversation_id` |
| `text`            | `text`                     | Texto exibido e enviado ao clicar                 |
| `position`        | `integer`                  | Ordem sugerida. `0` é a primeira                  |
| `date`            | `timestamp with time zone` | Data de gravação                                  |

A tabela **não tem `user_id`**, pelo mesmo motivo das mensagens: `conversation_id` só é alcançável a partir de uma conversa já filtrada por usuário, e o `ON DELETE CASCADE` leva as sugestões embora quando a conversa é encerrada.

`position` existe porque a ordem faz parte do que a AI entendeu do contexto. Recalcular por data não daria o mesmo resultado: duas sugestões podem ter o mesmo timestamp, e `POST /api/suggestions` acrescenta ao fim da lista.

---

## Testar

O harness de desenvolvimento fica em `apps/chat-back/local/` e **é git-ignored**: um REPL de terminal e um smoke test. Ver a seção “Harness local” no [README do backend](../../apps/chat-back/README.md).

```bash
npm run repl    # REPL de terminal contra o backend
npm run smoke   # checagem ponta a ponta, sem interação
```

O provider que produz as sugestões roda dentro do Backend, em `src/services/ai/providers/`. Sem chave de modelo, `AI_PROVIDER=echo` devolve uma lista fixa — o suficiente para o smoke passar sem gastar cota.

O `smoke` cobre o fluxo de sugestão inteiro: leitura vazia, registro pela interface, id gerado pelo Backend, substituição pelas sugestões da AI, limpeza, `401` sem identidade, `400` no corpo inválido, o teto de 8 por conversa e o isolamento entre usuários.
