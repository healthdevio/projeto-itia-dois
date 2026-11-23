# Backend — `chat-back`

API do Chat Omnia. Recebe mensagens, mantém conversas e sugestões no PostgreSQL,
aplica o prompt do tenant e chama o provider de IA (`echo` ou NVIDIA NIM).
Construída com NestJS, TypeScript e Drizzle ORM.

## Requisitos

- Node.js 26 — as imagens Docker usam `node:26-alpine` e o CI usa a mesma major.
- PostgreSQL 16 com `pgvector` (a stack usa `pgvector/pgvector:pg16`).

## Como rodar

```bash
npm install
# crie um .env na raiz desta pasta com as variáveis abaixo
npm run start:dev
```

O servidor escuta em `CORE_PORT` (padrão `80`, vindo de `PORT` se aquele não
existir). Para rodar localmente sem NVIDIA, use `AI_PROVIDER=echo`.

### Variáveis de ambiente

| Variável            | Obrigatória  | Padrão                                | Para que serve                               |
| ------------------- | ------------ | ------------------------------------- | -------------------------------------------- |
| `DATABASE_URL`      | sim          | —                                     | Conexão do Postgres (`postgresql://...`)     |
| `CORE_PORT`         | não          | `80`                                  | Porta HTTP do Nest                           |
| `AI_PROVIDER`       | não          | `nvidia`                              | `nvidia` ou `echo`                           |
| `NVIDIA_API_KEY`    | com `nvidia` | —                                     | Chave da API da NVIDIA                       |
| `NVIDIA_MODEL`      | não          | `meta/llama-3.3-70b-instruct`         | Modelo usado                                 |
| `NVIDIA_BASE_URL`   | não          | `https://integrate.api.nvidia.com/v1` | Endpoint compatível com OpenAI               |
| `NVIDIA_TIMEOUT_MS` | não          | `300000`                              | Timeout por chamada ao provider              |
| `NVIDIA_MAX_TOKENS` | não          | `400`                                 | Teto de tokens da resposta                   |
| `AI_IGNORE_CONFIG`  | não          | desligado                             | `1` ignora o `config` enviado pela interface |
| `AI_NO_SUGGESTIONS` | não          | desligado                             | `1` desliga a geração de sugestões           |
| `OIDC_ISSUER`       | sim          | —                                     | Issuer aceito no JWT                         |
| `OIDC_AUDIENCE`     | sim          | —                                     | Audience aceita no JWT                       |
| `OIDC_JWKS_URL`     | sim          | —                                     | JWKS usado para validar a assinatura         |
| `OIDC_TENANT_CLAIM` | não          | `tenant_id`                           | Claim que escolhe o prompt do tenant         |
| `CORS_ORIGINS`      | não          | vazio                                 | Origens permitidas, separadas por vírgula    |
| `MIGRATIONS_FOLDER` | não          | `drizzle`                             | Pasta das migrations do Drizzle              |
| `NODE_ENV`          | não          | —                                     | `production` exige HTTPS em OIDC e JWKS      |

O `.env` é git-ignored. Segredos ficam no ambiente (Portainer/stack), nunca no
código nem no bundle do frontend.

## Endpoints

| Método   | Rota                         | Autenticação | O que faz                                       |
| -------- | ---------------------------- | ------------ | ----------------------------------------------- |
| `GET`    | `/health`                    | pública      | Status agregado; 200 mesmo com banco fora       |
| `GET`    | `/health/ready`              | pública      | Readiness: 200 com banco up, 503 com banco down |
| `GET`    | `/health/live`               | pública      | Liveness: sempre 200                            |
| `GET`    | `/api/conversations/current` | JWT          | Conversa atual com mensagens e estado           |
| `GET`    | `/api/conversations/active`  | JWT          | Conversa ativa (cria se não existir)            |
| `POST`   | `/api/conversations/rotate`  | JWT          | Encerra a ativa e abre uma nova                 |
| `POST`   | `/api/messages`              | JWT          | Envia mensagem, chama a IA e devolve resposta   |
| `GET`    | `/api/suggestions`           | JWT          | Sugestões ativas do usuário                     |
| `POST`   | `/api/suggestions`           | JWT          | Substitui as sugestões ativas                   |
| `DELETE` | `/api/suggestions`           | JWT          | Remove as sugestões ativas                      |

As respostas usam o envelope `{ success: true, data }` ou
`{ success: false, error }`. O contrato completo, por modelo, está em
[`docs/backend/`](../../docs/backend/README.md).

## Identidade

Todas as rotas `/api/*` passam pelo `IdentityGuard`:

- Exigem `Authorization: Bearer <JWT>`.
- Validam assinatura (JWKS), `issuer`, `audience`, expiração e algoritmo
  (`RS256`/`ES256`) com `jose`.
- O usuário vem do claim `sub`; o tenant, do claim configurado em
  `OIDC_TENANT_CLAIM` (padrão `tenant_id`).
- Headers `X-User-Id` e `X-Tenant-Id` enviados pelo cliente são **ignorados**.
- Sem token válido ou sem configuração OIDC, a resposta é `401`.

Em produção, `OIDC_ISSUER` e `OIDC_JWKS_URL` precisam ser `https:`. O Core não
deve ser exposto direto na internet: o Nginx publica apenas a interface e faz
proxy de `/api/` para ele.

## Banco e migrations

O schema fica em `src/db/schema.ts` e as migrations em `drizzle/`.

```bash
npm run db:generate  # gera a migration a partir do schema
npm run db:migrate   # aplica as migrations pendentes
npm run db:push      # empurra o schema direto (desenvolvimento)
npm run db:studio    # abre o Drizzle Studio
```

## Scripts

| Comando              | O que faz                                           |
| -------------------- | --------------------------------------------------- |
| `npm run start:dev`  | Nest em modo watch                                  |
| `npm run start`      | Nest sem watch                                      |
| `npm run start:prod` | Executa `dist/main.js`                              |
| `npm run build`      | Compila com `tsconfig.build.json`                   |
| `npm run typecheck`  | `tsc --noEmit -p tsconfig.build.json` (só produção) |
| `npm run lint`       | Oxlint com análise de tipos em `src/` e `test/`     |
| `npm test`           | 122 testes com `node:test` via `tsx`                |
| `npm run test:e2e`   | 1 teste e2e com Vitest + supertest                  |
| `npm run format`     | Prettier em `src/` e `test/`                        |

O CI de backend roda `typecheck`, `test` e `build`; o `lint` ainda é local. Para
checar também os testes, use `npx tsc --noEmit -p tsconfig.test.json`
(veja [`docs/estrutura/testes.md`](../../docs/estrutura/testes.md)).

## Estrutura

```
src/
├── controllers/      rotas HTTP (health, conversations, messages, suggestions)
├── middleware/       IdentityGuard (JWT OIDC)
├── models/           contratos e validações (chat, sugestões, tools, Host)
├── repositories/     acesso ao Postgres via Drizzle
├── services/ai/      providers, prompt, contexto e chamada ao modelo
├── services/tools/   validação, autorização e execução de ferramentas
└── db/               schema, client e migrations
```

## Documentação

- [`docs/backend/README.md`](../../docs/backend/README.md) — contrato da API por modelo.
- [`docs/backend/HostIntegration.md`](../../docs/backend/HostIntegration.md) — integração com o Sistema Host.
- [`docs/backend/refatoracao-hono-para-nest.md`](../../docs/backend/refatoracao-hono-para-nest.md) — migração de Hono para NestJS.
- [`docs/estrutura/testes.md`](../../docs/estrutura/testes.md) — suíte de testes.
- [`docs/ci_cd/`](../../docs/ci_cd/README.md) — pipeline de CI/CD.
