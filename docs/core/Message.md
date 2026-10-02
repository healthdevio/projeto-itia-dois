## Modelo de Message

Esse documento trata de como deve ser formatada o modelo do message que vem da interface, passa pelo core e então é enviada para o Mia AI.

#### O que é o message?

É responsável por enviar a mensagem do usuário para o core, onde processamento pode ser feito e então entregue para a AI como prompt.

Por conta disso, esse arquivo pode ser separado em duas etapas. Uma entre a interface e o core e outra do core para o Mia AI.

Esse json deve incluir os seguintes fields:

`String: message_id` Identifica a mensagem. Obrigatório.

`String: message` É o conteúdo da mensagem em si. Obrigatório. É o que o usuário digita.

`String: date` Data de envio da mensagem. ISO 8601

`String: metadata` Metadata sobre a mensagem.

`String: origin` Identifica a fonte da mensagem. Obrigatório.

`Object: config` Configuração escolhida pela interface para este envio — idioma, tom e tamanho da resposta. Opcional; quando falta, o Core completa com o default. Não é persistida: vale para esta mensagem. Ver [ChatConfig.md](./ChatConfig.md).

A interface deve esperar por códigos de HTTP dependendo no resultado da transferência.

`200` Sucesso.

`400` Json inválido.

`500` Erro interno.

`502` O servidor da Mia AI falhou. O Core funcionou; foi o serviço do qual ele depende que não respondeu. O corpo traz a causa como o servidor da Mia AI a reportou.

---

## Endpoint do Core

### Localização

O endpoint para receber mensagens da interface está disponível em:

```
POST /api/messages
```

**URL completa:** `http://localhost:3001/api/messages`

### Identidade

Este endpoint exige o header `X-User-Id`. Sem ele, a resposta é `401`. A mensagem entra na conversa ativa **de quem enviou**, e o contexto repassado à Mia AI é o desse usuário — nunca o de outro.

> `X-User-Id` não é autenticação: o Core confia no valor cru do header. Ver [Identidade e multi-usuário](./Conversation.md#identidade-e-multi-usuário).

### Request Body

O corpo da requisição deve conter o JSON no formato especificado acima, com `config` opcional.

**Exemplo de requisição:**

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

### Response Codes

| Código | Descrição                                                                                      |
| ------ | ---------------------------------------------------------------------------------------------- |
| `200`  | Mensagem processada com sucesso                                                                |
| `400`  | JSON inválido, campos obrigatórios faltando (message_id, message, origin) ou `config` inválido |
| `401`  | `X-User-Id` ausente ou inválido                                                                |
| `500`  | Erro interno ao processar mensagem                                                             |
| `502`  | O servidor da Mia AI falhou. O `error` traz a causa reportada por ele                          |

### Response Body (Sucesso - 200)

```json
{
  "success": true,
  "data": {
    "message_id": "msg-123",
    "mia_ai_response": "Olá! Como posso ajudar hoje?",
    "suggestions": [{ "suggestion_id": "sg-1", "text": "Ver meu agendamento" }],
    "config": {
      "language": "pt-BR",
      "tone": "informal",
      "response_length": "short"
    }
  }
}
```

`suggestions` traz as sugestões da conversa depois desta resposta, para a
interface não precisar de um `GET /api/suggestions` logo em seguida. Vem sempre
presente: são as que a Mia AI devolveu com a resposta, ou as que já estavam lá
quando ela não devolveu nenhuma. Ver [Sugestão.md](./Suggestion.md).

`config` traz a configuração efetiva deste envio — a que foi repassada para a
Mia AI, já com o que faltava preenchido pelo default do Core. É o que permite à
tela mostrar o que vale sem guardar a configuração por conta própria. Ver
[ChatConfig.md](./ChatConfig.md).

### Response Body (Erro - 400/500/502)

```json
{
  "success": false,
  "error": "Campos obrigatórios faltando: message_id, message, origin"
}
```

`config` inválido tem o seu próprio erro, que diz o campo e os valores aceitos:

```json
{
  "success": false,
  "error": "config.tone deve ser um de: formal, neutral, informal"
}
```

Nesse caso a mensagem **não** é gravada na conversa e a Mia AI **não** é
chamada: a validação acontece antes de qualquer escrita.

Quando a falha vem do servidor da Mia AI (`502`), o `error` traz a causa que
ele reportou, em vez de uma mensagem genérica:

```json
{
  "success": false,
  "error": "Mia AI respondeu com erro: Authorization failed"
}
```

Isso é o que permite à interface diferenciar "falhou lá fora" de "falhou por
bug no Core", e oferecer retry só no primeiro caso. O Core não sabe — e não
precisa saber — _por que_ o outro lado falhou; só precisa não descartar a
informação.

---

## Integração com Mia AI

### Localização do Serviço

```
apps/chat-mia core/src/services/mia-ai.ts
```

### Como funciona

1. A interface envia a mensagem, com `X-User-Id`, para o endpoint `/api/messages`
2. O Core valida e processa a mensagem, e valida o `config` antes de qualquer escrita
3. O Core grava a mensagem na conversa ativa **do usuário**, já existente ou recém-criada
4. O Core monta o **contexto** da conversa (mensagens anteriores + ids do histórico) e envia `{ message, context, config }` para o servidor da Mia AI
5. O Core grava a resposta da Mia AI na conversa com `role: "mia"`
6. Se a resposta trouxe `suggestions`, o Core substitui as sugestões da conversa pelas novas
7. A resposta da Mia AI, as sugestões da conversa e o `config` efetivo são retornados para a interface

### O Core não sabe o que é um modelo de linguagem

Esta é a fronteira central do design. O Core **não** conhece provider, modelo,
prompt, temperatura, nem o formato de requisição de nenhuma API de IA. Tudo isso
é responsabilidade do servidor da Mia AI (`apps/packages/mia-ai`).

O Core sabe apenas três coisas:

1. O contrato de contexto `MiaAIContext`, que ele mesmo monta a partir do estado
   que guarda.
2. O contrato de configuração `ChatConfig`, que ele repassa sem interpretar —
   o `formal` é uma etiqueta de interface, e o que ela vira é problema da Mia AI.
3. O endpoint HTTP da Mia AI, para onde vai `{ message, context, config }` e de
   onde volta um texto.

Consequências práticas:

- Nenhuma credencial de modelo é passada ao Core. Se um `.env` do Core
  aparecer com chave de provider, algo foi colocado no lugar errado.
- Trocar de provider de IA não toca o Core.
- O Core não consegue cumprir nenhuma função de IA por conta própria: ele não
  sabe gerar texto, nem resumir, nemEmbedding. Quem responde é a Mia AI.

### Contrato com o servidor da Mia AI

Requisição — `POST $MIA_AI_ENDPOINT`:

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

Resposta — `200`:

```json
{
  "response": "Olá! Como posso ajudar?",
  "suggestions": [{ "text": "Ver meu agendamento" }]
}
```

O envelope `success`/`data` do próprio Core também é aceito como alternativa,
para um servidor da Mia AI escrito à mão não ter que acertar o formato exato.

`suggestions` é opcional, e o `suggestion_id` de cada item também: quando falta,
o Core gera. Cada item aceita `{ "text": "..." }` ou a string do texto direto.
Ver [Sugestões na resposta](#sugestões-na-resposta).

Se `MIA_AI_SERVICE_TOKEN` estiver definido, vai como `Authorization: Bearer`.
Isso autentica a chamada **entre serviços** e não tem relação com a identidade
do usuário, que vem de `X-User-Id`.

### Sugestões na resposta

A Mia AI pode anexar sugestões à resposta — as ações que o usuário poderia tomar
a seguir. O Core as grava na conversa ativa de quem enviou e as devolve em
`data.suggestions`, para a interface renderizar as chips sem uma segunda chamada.

```json
{
  "success": true,
  "data": {
    "message_id": "msg-123",
    "mia_ai_response": "Você tem consulta amanhã às 14h.",
    "suggestions": [{ "suggestion_id": "sg-1", "text": "Reagendar" }]
  }
}
```

O campo é **opcional e a diferença importa**:

| O que a Mia AI devolve          | O que o Core faz com as sugestões da conversa |
| ------------------------------- | --------------------------------------------- |
| `suggestions: [...]`            | Substitui pelas novas                         |
| `suggestions: []`               | Limpa                                         |
| campo `suggestions` **ausente** | **Preserva** as que já estavam                |

Sugestão malformada é descartada sem derrubar a resposta: o texto da Mia AI é o
que a interface precisa mostrar, e uma sugestão ruim é um detalhe a menos.

O modelo completo está em [Suggestion.md](./Suggestion.md).

### Contexto e a conversa

> **A conversa não é enviada para a Mia AI.** Ela é estado interno do Core, storeado no Postgres.
> O que chega ao servidor da Mia AI é a mensagem nova, o contexto — as mensagens anteriores e os ids das conversas passadas — e a configuração que a interface pediu. É o suficiente para a Mia AI responder com consciência do diálogo.

Isso significa que a Mia AI não guarda estado: todo o histórico é reconstruído pelo Core a partir do Postgres no momento de cada envio.

O formato do `MiaAIContext` está em [Conversation.md](./Conversation.md#miaaicontext).

### Configuração da conversa

A interface pode mandar `config` junto da mensagem, e o Core o repassa no topo do payload, ao lado de `message` e `context`:

```json
"config": { "language": "pt-BR", "tone": "formal", "response_length": "detailed" }
```

Ele fica **fora** do `context` porque não é estado da conversa: o `context` é o que o Core leu do Postgres, e o `config` é o que a tela pediu agora. É um despacho, não um histórico — por isso não é storeado e não volta em `GET /api/conversations`.

O Core valida o formato, preenche o que faltar com o default e repassa sem interpretar. Quem decide o que fazer com as etiquetas é a Mia AI, e um servidor que não conhece o campo pode ignorá-lo. O modelo completo está em [ChatConfig.md](./ChatConfig.md).

### Estados da conversa durante o envio

O Core alterna o `state` da conversa conforme o resultado, para que a interface saiba o que renderizar:

| Momento                               | `state`    |
| ------------------------------------- | ---------- |
| Antes do envio                        | `idle`     |
| Mensagem gravada, aguardando a Mia AI | `thinking` |
| Resposta gravada                      | `idle`     |
| Falha no envio                        | `error`    |

A máquina de estados completa está em [Conversation.md](./Conversation.md#conversationstate).

### TODO para futura implementação

- [ ] Retry com backoff no `502` do servidor da Mia AI
- [ ] Streaming da resposta, para a Mia AI aparecer token a token
- [ ] Circuit breaker para o servidor da Mia AI (hoje só há timeout)
- [ ] Autenticação real no Core (hoje `X-User-Id` não autentica nada — ver [Conversation.md](./Conversation.md))

### Variáveis de Ambiente

| Variável               | Descrição                                 | Padrão          |
| ---------------------- | ----------------------------------------- | --------------- |
| `CORE_PORT`            | Porta do servidor Core                    | `3001`          |
| `DATABASE_URL`         | Conexão Postgres que storeia as conversas | — (obrigatória) |
| `MIA_AI_ENDPOINT`      | Endpoint do **servidor** da Mia AI        | — (obrigatória) |
| `MIA_AI_SERVICE_TOKEN` | Autenticação da chamada entre serviços    | — (opcional)    |
| `MIA_AI_TIMEOUT_MS`    | Tempo máximo de espera pela Mia AI        | `60000`         |
