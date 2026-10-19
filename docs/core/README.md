# Core

Contrato da API, para quem consome.

| Documento                          | Assunto                                          |
| ---------------------------------- | ------------------------------------------------ |
| [Conversation.md](Conversation.md) | Conversa, estados, persistência e contexto da AI |
| [Message.md](Message.md)           | Modelo de mensagem e endpoint de envio           |
| [Suggestion.md](Suggestion.md)     | Sugestões, endpoints e limites                   |
| [ChatConfig.md](ChatConfig.md)     | Configuração e o repasse para a AI               |

## Resumo dos endpoints

| Método   | Rota                         | Quem chama   |
| -------- | ---------------------------- | ------------ |
| `GET`    | `/`                          | health check |
| `GET`    | `/api/conversations/current` | interface    |
| `GET`    | `/api/conversations/active`  | interface    |
| `POST`   | `/api/conversations/rotate`  | interface    |
| `POST`   | `/api/messages`              | interface    |
| `GET`    | `/api/suggestions`           | interface    |
| `POST`   | `/api/suggestions`           | interface    |
| `DELETE` | `/api/suggestions`           | interface    |

## Identidade

Todos os endpoints de conversa, mensagem e sugestão exigem o header `X-User-Id`.

```bash
curl -H "X-User-Id: ana" http://localhost:3001/api/conversations/current
```

Sem o header, a resposta é `401`.

> **`X-User-Id` não é autenticação.** O Core confia no valor cru: qualquer cliente
> pode enviar o que quiser e impersonar outro usuário. Num ambiente com usuários
> reais, um proxy na frente precisa validar um token (JWT, sessão, mTLS) e
> reescrever o header com o subject autenticado.

O header `X-Tenant-Id` é opcional e escolhe apenas o prompt da requisição. Ele
não concede acesso a nada.

## Onde a API está documentada

O contrato completo está no `README.md` de `apps/chat-core`. Esta pasta tem a
especificação por modelo; o README tem o ponto de entrada prático.
