## Modelo de Message

Esse documento trata de como deve ser formatada o modelo do message que vem da interface, passa pelo core e então é enviada para o Mia AI.

#### O que é o message?

É responsável por enviar a mensagem do usuário para o core, onde processamento pode ser feito e então entregue para a AI como prompt.

Por conta disso, esse arquivo pode ser separado em duas etapas. Uma entre a interface e o core, e outra do core para o provider da Mia AI.

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

`502` O provider da Mia AI falhou. O Core funcionou; foi o provider de quem ele depende que não respondeu. O corpo traz a causa como o provider a reportou.

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
| `502`  | O provider da Mia AI falhou. O `error` traz a causa reportada por ele                          |

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

Quando a falha vem do provider da Mia AI (`502`), o `error` traz a causa que ele
reportou, em vez de uma mensagem genérica:

```json
{
  "success": false,
  "error": "NVIDIA 401: {\"detail\":\"invalid api key\"}"
}
```

O timeout aparece na mesma forma, dizendo o teto que estourou:

```json
{
  "success": false,
  "error": "Falha ao chamar a Nvidia: tempo esgotado após 300000ms"
}
```

Isso é o que permite à interface diferenciar "falhou no provider" de "falhou por
bug no Core", e oferecer retry só no primeiro caso. O Core não sabe — e não
precisa saber — _por que_ o provider falhou; só precisa não descartar a
informação.

---

## Integração com Mia AI

### Localização do Serviço

```
apps/chat-mia core/src/services/mia-ai/
├── index.ts          API pública (buildContext, sendToMiaAI, MiaAIError)
├── context.ts        Montagem do contexto da conversa
├── provider.ts       Interface AIProvider + registro dos providers
├── prompt.ts         { message, context, config } → mensagens de chat
└── providers/
    ├── nvidia.ts     Substituto de teste: backend da Nvidia
    └── echo.ts       Texto fixo, sem chamar modelo
```

### Como funciona

1. A interface envia a mensagem, com `X-User-Id`, para o endpoint `/api/messages`
2. O Core valida e processa a mensagem, e valida o `config` antes de qualquer escrita
3. O Core grava a mensagem na conversa ativa **do usuário**, já existente ou recém-criada
4. O Core monta o **contexto** da conversa (mensagens anteriores + ids do histórico) e entrega `{ message, context, config }` ao provider da Mia AI
5. O Core grava a resposta da Mia AI na conversa com `role: "mia"`
6. Se a resposta trouxe `suggestions`, o Core substitui as sugestões da conversa pelas novas
7. A resposta da Mia AI, as sugestões da conversa e o `config` efetivo são retornados para a interface

### O Core não sabe o que é um modelo de linguagem

Esta é a fronteira central do design. O Core **não** conhece provider, modelo,
prompt, temperatura, nem o formato de requisição de nenhuma API de IA. Tudo isso
vive atrás da interface `AIProvider`, em `src/services/mia-ai/providers/`.

O provider roda **dentro do processo do Core** — não há mais salto HTTP para um
serviço da Mia AI separado. O que era contrato de rede virou contrato de
interface, e o provider em uso hoje é um substituto temporário de teste.

O Core sabe apenas três coisas:

1. O contrato de contexto `MiaAIContext`, que ele mesmo monta a partir do estado
   que guarda.
2. O contrato de configuração `ChatConfig`, que ele repassa sem interpretar —
   o `formal` é uma etiqueta de interface, e o que ela vira é problema do
   provider.
3. A interface `AIProvider`, para quem vai `{ message, context, config }` e de
   onde volta um texto.

Consequências práticas:

- Nenhuma chave de modelo atravessa a fronteira das rotas: ela é lida só dentro
  de `providers/`. Se uma rota precisar de `NVIDIA_API_KEY`, algo foi colocado no
  lugar errado.
- Trocar de provider de IA não toca rotas, modelos, repositórios nem banco: é um
  arquivo novo em `providers/` e uma linha no registro de `createProvider`.
- O Core não consegue cumprir nenhuma função de IA por conta própria: ele não
  sabe gerar texto, nem resumir, nem fazer embedding. Quem responde é o provider.

### Contrato com o provider da Mia AI

Requisição — o que o Core entrega a `AIProvider.respond()`:

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

Resposta:

```json
{
  "response": "Olá! Como posso ajudar?",
  "suggestions": [{ "suggestion_id": "sg-1", "text": "Ver meu agendamento" }]
}
```

`suggestions` é opcional, e o `suggestion_id` de cada item também: quando falta,
o Core gera. Cada item aceita `{ "text": "..." }` ou a string do texto direto.
Ver [Sugestões na resposta](#sugestões-na-resposta).

### Tempo de espera pelo modelo

O provider não devolve a resposta pronta: o modelo escreve token a token, e uma
resposta longa passa dos 60 s sem que nada esteja errado. Um teto de 60 s cortava
a geração no meio da digitação, devolvendo `502` em vez da resposta que estava a
caminho.

O padrão é `NVIDIA_TIMEOUT_MS=300000` (5 min), aplicado à geração inteira e não
ao primeiro byte. Continua sendo um teto — um provider pendurado precisa virar
erro — e continua configurável, porque em teste local um teto menor é melhor que
esperar cinco minutos por um provider que morreu.

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
> O que chega ao provider da Mia AI é a mensagem nova, o contexto — as mensagens anteriores e os ids das conversas passadas — e a configuração que a interface pediu. É o suficiente para a Mia AI responder com consciência do diálogo.

Isso significa que a Mia AI não guarda estado: todo o histórico é reconstruído pelo Core a partir do Postgres no momento de cada envio.

O formato do `MiaAIContext` está em [Conversation.md](./Conversation.md#miaaicontext).

### Configuração da conversa

A interface pode mandar `config` junto da mensagem, e o Core o repassa no topo do payload, ao lado de `message` e `context`:

```json
"config": { "language": "pt-BR", "tone": "formal", "response_length": "detailed" }
```

Ele fica **fora** do `context` porque não é estado da conversa: o `context` é o que o Core leu do Postgres, e o `config` é o que a tela pediu agora. É um despacho, não um histórico — por isso não é storeado e não volta em `GET /api/conversations`.

O Core valida o formato, preenche o que faltar com o default e repassa sem interpretar. Quem decide o que fazer com as etiquetas é o provider, e um provider que não conhece o campo pode ignorá-lo. O modelo completo está em [ChatConfig.md](./ChatConfig.md).

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

- [ ] Retry com backoff no `502` do provider da Mia AI
- [ ] Streaming da resposta, para a Mia AI aparecer token a token
- [ ] Substituir o provider de teste pela Mia AI de verdade (`providers/` foi feito para isso)
- [ ] Autenticação real no Core (hoje `X-User-Id` não autentica nada — ver [Conversation.md](./Conversation.md))

### Variáveis de Ambiente

| Variável                | Descrição                                 | Padrão                                |
| ----------------------- | ----------------------------------------- | ------------------------------------- |
| `CORE_PORT`             | Porta do servidor Core                    | `3001`                                |
| `DATABASE_URL`          | Conexão Postgres que storeia as conversas | — (obrigatória)                       |
| `MIA_AI_PROVIDER`       | Provider da Mia AI: `nvidia` ou `echo`    | `nvidia`                              |
| `NVIDIA_API_KEY`        | Chave do backend da Nvidia                | — (com `nvidia`)                      |
| `NVIDIA_MODEL`          | Modelo de chat do NIM                     | `meta/llama-3.3-70b-instruct`         |
| `NVIDIA_BASE_URL`       | Base do NIM (compatível com a OpenAI)     | `https://integrate.api.nvidia.com/v1` |
| `NVIDIA_TIMEOUT_MS`     | Teto de espera pelo modelo                | `300000` (5 min)                      |
| `NVIDIA_MAX_TOKENS`     | Tokens máximos por resposta               | `400`                                 |
| `MIA_AI_IGNORE_CONFIG`  | `1` = ignora o `config` da interface      | — (opcional)                          |
| `MIA_AI_NO_SUGGESTIONS` | `1` = não devolve `suggestions`           | — (opcional)                          |
