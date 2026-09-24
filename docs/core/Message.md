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

| Código | Descrição |
|--------|-----------|
| `200` | Mensagem processada com sucesso |
| `400` | JSON inválido ou campos obrigatórios faltando (message_id, message, origin) |
| `500` | Erro interno ao processar mensagem |

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
1. A interface envia a mensagem para o endpoint `/api/messages`
2. O Core valida e processa a mensagem
3. O Core envia a mensagem para a Mia AI (atualmente simulado)
4. A resposta da Mia AI é retornada para a interface

### TODO para futura implementação
- [ ] Implementar chamada HTTP real para o endpoint da Mia AI
- [ ] Adicionar tratamento de erros e retries
- [ ] Implementar autenticação se necessário
- [ ] Adicionar timeout e circuit breaker
- [ ] Configurar variáveis de ambiente para o endpoint da Mia AI

### Variáveis de Ambiente
| Variável | Descrição | Padrão |
|----------|-----------|--------|
| `CORE_PORT` | Porta do servidor Core | `3001` |
| `MIA_AI_ENDPOINT` | Endpoint da Mia AI (futuro) | `http://localhost:3002/api/chat` |
