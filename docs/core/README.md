# Core

Contrato da API, para quem consome.

| Documento                          | Assunto                                                       |
| ---------------------------------- | ------------------------------------------------------------- |
| [Conversation.md](Conversation.md) | Conversa, estados, persistência e contexto da AI              |
| [Message.md](Message.md)           | Modelo de mensagem e endpoint de envio                        |
| [Suggestion.md](Suggestion.md)     | Sugestões, endpoints e limites                                |
| [ChatConfig.md](ChatConfig.md)     | Configuração e o repasse para a AI                            |
| [ChatContext.md](ChatContext.md)   | Estrutura de contexto adicional para a Omnia IA e integrações |

## Tasks de DevOps

- [Task 01 — Modelo Tool](../tasks-devops/task-01/Tool.md)
- [Task 02 — Modelo ToolCall](../tasks-devops/task-02/ToolCall.md)
- [Task 03 — JSON Schema das ferramentas](../tasks-devops/task-03/JSON-Schema.md)

## Resumo dos endpoints

| Método   | Rota                         | Quem chama   |
| -------- | ---------------------------- | ------------ |
| `GET`    | `/health`                    | health check |
| `GET`    | `/api/conversations/current` | interface    |
| `GET`    | `/api/conversations/active`  | interface    |
| `POST`   | `/api/conversations/rotate`  | interface    |
| `POST`   | `/api/messages`              | interface    |
| `GET`    | `/api/suggestions`           | interface    |
| `POST`   | `/api/suggestions`           | interface    |
| `DELETE` | `/api/suggestions`           | interface    |

## Identidade

Todos os endpoints de conversa, mensagem e sugestão exigem JWT OIDC válido no header `Authorization: Bearer`.

```bash
curl -H "Authorization: ******" http://localhost:3001/api/conversations/current
```

Sem token válido ou sem configuração OIDC, a resposta é `401`.

> O Core valida assinatura, issuer, audience e expiração do JWT via JWKS. Configure
> `OIDC_ISSUER`, `OIDC_AUDIENCE` e `OIDC_JWKS_URL`; o claim `sub` determina o
> usuário. Headers `X-User-Id` e `X-Tenant-Id` enviados pelo cliente são ignorados.

O tenant opcional vem do claim configurado em `OIDC_TENANT_CLAIM` (padrão
`tenant_id`) e escolhe apenas o prompt da requisição. Ele não concede acesso.

## Onde a API está documentada

O contrato completo está no `README.md` de `apps/chat-back`. Esta pasta tem a
especificação por modelo; o README tem o ponto de entrada prático.

O processo de migração da camada HTTP de Hono para NestJS (causas, mudanças,
verificação e rollback) está em
[refatoracao-hono-para-nest.md](refatoracao-hono-para-nest.md).
