# Chat Mia Core

O Core do Chat Mia é responsável por receber mensagens da interface, processá-las e enviá-las para a Mia AI.

## Estrutura

```
src/
├── index.ts              # Servidor principal com os endpoints
├── models/
│   └── message.ts        # Modelo de mensagem e interfaces
├── services/
│   └── mia-ai.ts         # Serviço de integração com Mia AI
├── contracts/            # Contratos (futuro)
└── events/               # Eventos (futuro)
```

## Instalação

```bash
# Instalar dependências
npm install

# Ou com yarn
yarn install
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

**Response:**
```json
{
  "status": "ok",
  "service": "chat-mia-core"
}
```

### Enviar Mensagem
```
POST /api/messages
```

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

**Response (400/500):**
```json
{
  "success": false,
  "error": "Campos obrigatórios faltando: message_id, message, origin"
}
```

## Variáveis de Ambiente

| Variável | Descrição | Padrão |
|----------|-----------|--------|
| `CORE_PORT` | Porta do servidor | `3001` |
| `MIA_AI_ENDPOINT` | Endpoint da Mia AI (futuro) | `http://localhost:3002/api/chat` |

## Integração com Mia AI

O serviço de integração com a Mia AI está localizado em `src/services/mia-ai.ts`. Atualmente é um placeholder que simula a resposta. Para implementar a integração real:

1. Configure a variável de ambiente `MIA_AI_ENDPOINT`
2. Implemente a chamada HTTP no arquivo `mia-ai.ts`
3. Adicione tratamento de erros e retries conforme necessário

## Documentação

Consulte `docs/core/Message.md` para mais detalhes sobre o modelo de mensagem e o endpoint.
