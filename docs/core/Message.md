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

A interface deve esperar por códigos de HTTP dependendo no resultado da transferência.

`200` Sucesso.

`400` Json inválido.

`500` Erro interno.

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

O corpo da requisição deve conter o JSON no formato especificado acima.

**Exemplo de requisição:**

```json
{
  "message_id": "msg-123",
  "message": "Olá, como vai?",
  "date": "2026-09-18T10:30:00.000Z",
  "metadata": "info adicional",
  "origin": "frontend"
}
```

### Response Codes

| Código | Descrição                                                                   |
| ------ | --------------------------------------------------------------------------- |
| `200`  | Mensagem processada com sucesso                                             |
| `400`  | JSON inválido ou campos obrigatórios faltando (message_id, message, origin) |
| `401`  | `X-User-Id` ausente ou inválido                                             |
| `500`  | Erro interno ao processar mensagem                                          |

### Response Body (Sucesso - 200)

```json
{
  "success": true,
  "data": {
    "message_id": "msg-123",
    "mia_ai_response": "[Mia AI] Mensagem msg-123 recebida. Integração ainda não implementada."
  }
}
```

### Response Body (Erro - 400/500)

```json
{
  "success": false,
  "error": "Campos obrigatórios faltando: message_id, message, origin"
}
```

---

## Integração com Mia AI

O Core possui um serviço placeholder para futura integração com a Mia AI.

### Localização do Serviço

```
apps/chat-mia core/src/services/mia-ai.ts
```

### Como funciona

1. A interface envia a mensagem, com `X-User-Id`, para o endpoint `/api/messages`
2. O Core valida e processa a mensagem
3. O Core grava a mensagem na conversa ativa **do usuário**, já existente ou recém-criada
4. O Core monta o **contexto** da conversa (mensagens anteriores + ids do histórico) e envia `{ message, context }` para a Mia AI (atualmente simulado)
5. O Core grava a resposta da Mia AI na conversa com `role: "mia"`
6. A resposta da Mia AI é retornada para a interface

### Contexto e a conversa

> **A conversa não é enviada para a Mia AI.** Ela é estado interno do Core, storeado no Postgres.
> O que chega à Mia AI é apenas a mensagem nova e o contexto — as mensagens anteriores e os ids das conversas passadas — para que ela responda com consciência do diálogo.

Isso significa que a Mia AI não guarda estado: todo o histórico é reconstruído pelo Core a partir do Postgres no momento de cada envio.

O formato do `MiaAIContext` está em [Conversation.md](./Conversation.md#miaaicontext).

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

- [ ] Implementar chamada HTTP real para o endpoint da Mia AI
- [ ] Adicionar tratamento de erros e retries
- [ ] Implementar autenticação se necessário
- [ ] Adicionar timeout e circuit breaker
- [ ] Configurar variáveis de ambiente para o endpoint da Mia AI
- [ ] Carregar `history_ids` no contexto (hoje vai vazio)

### Variáveis de Ambiente

| Variável          | Descrição                                 | Padrão                           |
| ----------------- | ----------------------------------------- | -------------------------------- |
| `CORE_PORT`       | Porta do servidor Core                    | `3001`                           |
| `DATABASE_URL`    | Conexão Postgres que storeia as conversas | — (obrigatória)                  |
| `MIA_AI_ENDPOINT` | Endpoint da Mia AI (futuro)               | `http://localhost:3002/api/chat` |
