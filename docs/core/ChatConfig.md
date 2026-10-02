## Modelo de ChatConfig

Esse documento trata da configuração que a interface escolhe na tela e o Core repassa para a Mia AI: idioma, tom e tamanho da resposta.

```json
{ "language": "pt-BR", "tone": "neutral", "response_length": "standard" }
```

#### O que é o config?

É o **como** o usuário quer ser atendido. Não é o **com o que** a resposta é gerada: provider, modelo, temperatura e prompt continuam sendo da Mia AI, e nenhum deles chega ao Core. É a mesma fronteira de [Message.md](./Message.md#o-core-não-sabe-o-que-é-um-modelo-de-linguagem), vista do lado de quem manda a configuração.

O Core não interpreta nada disso. Ele valida o formato, completa o que faltar e repassa as etiquetas — quem decide o que `formal` significa para o modelo é o servidor da Mia AI.

### Quem escreve e quem lê

```
  interface                 Core                    Mia AI
     │ POST /api/messages    │                       │
     │ { message, config }  │                       │
     │──────────────────────►│  valida e completa    │
     │                       │                       │
     │                       │ { message, context,   │
     │                       │   config }            │
     │                       │──────────────────────►│
     │◄──────────────────────│ { …, config }         │
```

A **interface** escreve, a **Mia AI** lê, e **ninguém guarda**. O config não tem tabela, não entra na conversa e não volta em `GET /api/conversations`. Ele vale para a mensagem que o trouxe — mudar o tom no meio do chat vale a partir da mensagem seguinte.

> É o que diferencia o config da conversa: a conversa é estado do Core, o config é um despacho.

---

## Campos

| Campo             | Tipo     | Valores                         | Default    |
| ----------------- | -------- | ------------------------------- | ---------- |
| `language`        | `string` | `pt-BR`, `en-US`                | `pt-BR`    |
| `tone`            | `string` | `formal`, `neutral`, `informal` | `neutral`  |
| `response_length` | `string` | `short`, `standard`, `detailed` | `standard` |

Os três são opcionais na entrada e **sempre** presentes na saída. `response_length` não é contagem de tokens: o Core não sabe o que cabe na janela do modelo, e cada provider conta diferente.

Acrescentar um valor a qualquer lista é **mudança de contrato**: uma interface que não conhece a opção nova continua funcionando (manda o que conhece e leva o default no resto), mas uma Mia AI que não conhece o valor novo precisa saber o que fazer com ele antes de a interface começar a oferecer.

### Todo envio leva um config

Config ausente ou parcial é preenchido com `DEFAULT_CHAT_CONFIG`. A Mia AI não precisa adivinhar se `tone` sumiu porque a interface não oferece a opção ou porque o Core descartou — o que chega do outro lado está sempre completo.

O mesmo config que foi repassado volta na resposta de `POST /api/messages`, para a interface conferir que a tela e o envio estão de acordo sem precisar reproduzir os defaults por conta própria.

---

## Endpoint

O config **não tem endpoint próprio**: ele viaja no corpo da mensagem, porque é o que a interface tem no momento do envio.

```
POST /api/messages
```

Exige `X-User-Id` e os campos obrigatórios da mensagem (`message_id`, `message`, `origin`). Ver [Message.md](./Message.md#request-body).

**Request Body** — `config` é opcional:

```json
{
  "message_id": "msg-123",
  "message": "Olá, como vai?",
  "date": "2026-09-18T10:30:00.000Z",
  "origin": "frontend",
  "config": { "tone": "informal", "response_length": "short" }
}
```

**Response Body (200)** — `data.config` é a configuração efetiva, já completada:

```json
{
  "success": true,
  "data": {
    "message_id": "msg-123",
    "mia_ai_response": "Olá! Como posso ajudar hoje?",
    "suggestions": [],
    "config": {
      "language": "pt-BR",
      "tone": "informal",
      "response_length": "short"
    }
  }
}
```

No exemplo, a interface pediu dois campos e o Core entregou os três: `language` não veio e entrou o default.

### Códigos

| Código | Descrição                                                             |
| ------ | --------------------------------------------------------------------- |
| `200`  | Mensagem processada, com o config efetivo em `data.config`            |
| `400`  | `config` inválido. O erro diz o campo e os valores aceitos            |
| `401`  | `X-User-Id` ausente ou inválido                                       |
| `500`  | Erro interno ao processar mensagem                                    |
| `502`  | O servidor da Mia AI falhou. O `error` traz a causa reportada por ele |

**Response Body (400):**

```json
{
  "success": false,
  "error": "config.tone deve ser um de: formal, neutral, informal"
}
```

O erro traz os valores válidos porque é a interface que corrige: um "config inválido" sem dizer o que era aceito obriga o cliente a adivinhar a lista, e o único lugar onde ela está é este repositório.

A validação acontece **antes** de qualquer escrita: uma mensagem com `config` inválido não é gravada na conversa e não chega à Mia AI.

---

## Regras de validação

| O que veio                              | O que o Core faz                        |
| --------------------------------------- | --------------------------------------- |
| `config` ausente, ou `null`             | Usa o `DEFAULT_CHAT_CONFIG`             |
| objeto com alguns campos                | Completa o que falta com o default      |
| campo conhecido com valor fora da lista | **`400`**, dizendo o campo e os valores |
| chave que o Core não conhece            | Ignora                                  |
| `config` que não é objeto               | **`400`**                               |

**Chave desconhecida é ignorada, e não recusada**, porque o config é contrato de dois lados. Uma interface mais nova pode mandar um campo que este Core ainda não conhece, e um Core mais velho não pode quebrar o chat por causa disso. O inverso — um servidor da Mia AI que não conhece o `config` — também é seguro, porque o campo chega no topo do payload e ele pode simplesmente ignorá-lo.

Já um valor inválido em campo conhecido **é** erro: a interface está oferecendo um caminho que não existe, e um `400` explicando qual valor era válido é mais barato do que uma resposta em tom errado.

---

## Integração com a Mia AI

O `config` vai no **topo** do payload, ao lado de `message` e `context` — não dentro do `context`.

```json
{
  "message": {
    "message_id": "msg-123",
    "message": "Olá",
    "origin": "frontend"
  },
  "context": {
    "conversation_id": "9f1c2a44-...",
    "state": "idle",
    "previous_messages": [
      { "message_id": "msg-100", "message": "oi", "role": "user" }
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

Fora do `context` porque **não é estado da conversa**: o `context` é o que o Core leu do Postgres, e o `config` é o que a interface pediu agora. Misturar os dois esconderia essa origem — e é a origem que explica por que o config não sobrevive à próxima mensagem.

A resposta da Mia AI não muda: `{"response": "...", "suggestions": [...]}`. Quem fala com o config é a Mia AI, e ela faz isso como quiser — prompt, parâmetro do provider, o que o seu backend souber fazer.

### Sem estado no Core

Não há tabela, repositório nem endpoint de config. A implementação está isolada em [`src/models/chat-config.ts`](../../apps/chat-mia%20core/src/models/chat-config.ts): validação, defaults e o resumo que aparece nos logs dos dois lados.

Quando aparecer a necessidade de **lembrar** a escolha do usuário (para a tela já abrir com o tom que ele escolheu da última vez), aí sim o config ganha tabela e um `GET /api/config`. O modelo já está separado para essa hora: `ChatConfig` é o que a interface manda, e o que vier a ser guardado é outra coisa.

### Logs

O Core e o servidor da Mia AI registram o mesmo resumo, então dá para conferir dos dois lados que o que a interface pediu é o que chegou:

```
[Core] Mensagem recebida de tty (usuário tty): tty-6bfefb0c · config pt-BR · formal · short
[Mia AI] tty-6bfefb0c → http://localhost:3002/api/chat (conversa 6e0cbf75-…, 2 mensagens de contexto, 1 conversas anteriores, config pt-BR · formal · short, 2 sugestões)
```

---

## Testar

O harness de desenvolvimento fica em `apps/chat-mia core/local/` e **é git-ignored**. Ele traz um servidor que substitui a Mia AI (com backend da Nvidia) e um REPL de terminal. Ver [`local/README.md`](../../apps/chat-mia%20core/local/README.md).

```bash
npm run stub    # Mia AI falsa
npm run repl    # REPL de terminal contra o Core
npm run smoke   # checagem ponta a ponta, sem interação
```

No REPL, `:config tone=formal length=short` escolhe o que o próximo envio vai carregar, e a resposta mostra o config que a Mia AI recebeu. No `smoke`, o repasse é coberto com config ausente, parcial, completo, inválido e com chave desconhecida.

### TODO

- [ ] Lembrar a configuração entre sessões (`GET /api/config`), se a interface precisar
- [ ] Configuração por perfil de paciente, se a clínica precisar de mais de um conjunto de opções
