# Refatoração do Backend: Hono → NestJS

Data: 2026-11-04
Branch: `refactor/migrar-modelos-para-nestjs`
PR: [#97](https://github.com/healthdevio/projeto-itia-dois/pull/97)
Commit final: `9a33b88` (`refactor(chat-back): port API Hono para NestJS`)
Base: `82df1c0` (`fix(ci): add Nest backend typecheck script`)
Status: PR aberta, `MERGEABLE`, todos os checks verdes.

---

## Resumo

O backend `apps/chat-back` deixou de ser um servidor HTTP Hono e passou a ser uma
aplicação NestJS. A migração não trocou o domínio: repositórios, schema Drizzle,
serviços de AI, modelos e contratos de resposta continuaram os mesmos. O que
mudou foi a camada HTTP.

| Antes                             | Depois                                 |
| --------------------------------- | -------------------------------------- |
| `src/index.ts` com `new Hono()`   | `src/main.ts` com `NestFactory.create` |
| Rotas em `src/routes/*.ts`        | Controllers em `src/controllers/*.ts`  |
| `identity` como middleware Hono   | `IdentityGuard` (`CanActivate`)        |
| `c.get('userId')`                 | `request.identity` populado pelo guard |
| `app.route('/api/...', rotas)`    | `@Controller('api/...')`               |
| `serve({ fetch: app.fetch })`     | `app.listen(port)`                     |
| `entrypoint.sh` → `dist/index.js` | `entrypoint.sh` → `dist/main.js`       |

---

## Ponto de partida

A PR #97 existia com a estrutura inicial do NestJS, mas o backend ainda não
funcionava como Nest:

- O Nest era apenas um "Hello World" (`AppController` / `AppService`).
- As rotas reais continuavam em Hono (`src/index.ts` e `src/routes/*.ts`).
- O `entrypoint.sh` da imagem ainda iniciava `dist/index.js` (servidor Hono).
- O build Docker compilava os arquivos Hono, embora o `package.json` já não
  tivesse Hono nas dependências.
- Os testes de rota ainda instanciavam o app Hono.
- O `package-lock.json` estava dessincronizado em relação ao `package.json`.

Três checks estavam vermelhos: `Backend (chat-back)` já havia sido corrigido em
`82df1c0`; restavam `npm audit (apps/chat-back)`, `Imagens Docker` e o agregador
`CI OK`.

---

## Causas raízes

### 1. `Imagens Docker`: build compilava código Hono sem Hono

O job executava `npm run build` (`nest build`). Como o Dockerfile copiava apenas
`tsconfig.json` — e não `tsconfig.build.json` —, o build não ficava restrito ao
grafo de `src/main.ts` e tentava compilar `src/index.ts` e `src/routes/*.ts`.
Esses arquivos importam `hono`, que já não estava instalado, gerando **39 erros
de TypeScript** (por exemplo, `Parameter 'c' implicitly has an 'any' type` em
`src/routes/suggestions.ts`).

### 2. `npm audit (apps/chat-back)`: dependência de desenvolvimento vulnerável

As duas vulnerabilidades HIGH vinham de `@nestjs/mau` (ferramenta opcional de
deploy do Nest CLI):

```text
@nestjs/mau → inquirer → external-editor → tmp   (HIGH)
@nestjs/mau → ... → undici                       (HIGH)
```

O `package.json` chegou a remover `@nestjs/mau`, mas o `package-lock.json` não
foi regenerado. Isso deixava o lock inconsistente — risco de `npm ci` falhar na
CI — e mantinha as vulnerabilidades no audit.

### 3. Runtime apontava para o entrypoint antigo

O `entrypoint.sh` executava `node dist/index.js`. Além disso, `src/db/migrate.ts`
não estava no `include` do `tsconfig.build.json`, então `dist/db/migrate.js`
(de que o entrypoint depende) não seria gerado em um build restrito.

---

## O que foi alterado

### Camada HTTP

| Arquivo removido              | Substituto                                    |
| ----------------------------- | --------------------------------------------- |
| `src/index.ts`                | `src/main.ts`                                 |
| `src/routes/conversations.ts` | `src/controllers/conversations.controller.ts` |
| `src/routes/messages.ts`      | `src/controllers/messages.controller.ts`      |
| `src/routes/suggestions.ts`   | `src/controllers/suggestions.controller.ts`   |
| —                             | `src/controllers/health.controller.ts`        |
| `src/app.controller.ts`       | — (Hello World removido)                      |
| `src/app.service.ts`          | — (Hello World removido)                      |
| `src/app.controller.spec.ts`  | — (teste do Hello World removido)             |

Também foram adicionados:

- `src/core-lifecycle.service.ts`: loga o provider de AI no boot e fecha o pool
  do Postgres no shutdown (`OnModuleInit` / `OnModuleDestroy`).
- `test/helpers/nest-app.ts`: sobe a aplicação Nest para os testes de rota.

### Mapa de endpoints

| Método   | Rota                         | Handler Nest                      |
| -------- | ---------------------------- | --------------------------------- |
| `GET`    | `/health`                    | `HealthController.status`         |
| `GET`    | `/health/ready`              | `HealthController.ready`          |
| `GET`    | `/health/live`               | `HealthController.live`           |
| `GET`    | `/api/conversations/current` | `ConversationsController.current` |
| `GET`    | `/api/conversations/active`  | `ConversationsController.active`  |
| `POST`   | `/api/conversations/rotate`  | `ConversationsController.rotate`  |
| `POST`   | `/api/messages`              | `MessagesController.create`       |
| `GET`    | `/api/suggestions`           | `SuggestionsController.list`      |
| `POST`   | `/api/suggestions`           | `SuggestionsController.add`       |
| `DELETE` | `/api/suggestions`           | `SuggestionsController.clear`     |

Os contratos de resposta foram preservados:

```json
{ "success": true, "data": {} }
{ "success": false, "error": "mensagem" }
```

O health check mantém `service: "chat-ai-core"` para não quebrar a documentação e
os consumidores existentes.

### Identidade

`src/middleware/identity.ts` deixou de exportar o middleware Hono `identity` e
passou a exportar `IdentityGuard`, um `CanActivate` do Nest. As regras foram
mantidas:

- `Authorization: Bearer <token>` obrigatório.
- Validação de assinatura, issuer, audience e `exp` via JWKS (`jose`).
- `OIDC_ISSUER`, `OIDC_AUDIENCE`, `OIDC_JWKS_URL` obrigatórios.
- HTTPS obrigatório para o issuer em produção.
- `sub` validado por `validateUserId`.
- Tenant opcional lido de `OIDC_TENANT_CLAIM` (padrão `tenant_id`).
- Headers `X-User-Id` / `X-Tenant-Id` continuam ignorados.
- `401` mantém o corpo `{ success: false, error }`.

Os controllers usam `@UseGuards(IdentityGuard)` e leem `request.identity`, no
lugar de `c.get('userId')` / `c.get('tenantId')`.

### Bootstrap

`src/main.ts` passou a:

- habilitar CORS com `CORS_ORIGINS` (lista separada por vírgula);
- permitir `Authorization` e `Content-Type`, com os mesmos métodos do Hono;
- habilitar shutdown hooks (`SIGINT` / `SIGTERM`);
- ouvir em `CORE_PORT`, depois `PORT`, com fallback `80`.

### Build e Docker

- `build` passou de `nest build` para `nest build -p tsconfig.build.json`, para
  não depender do default do CLI.
- `tsconfig.build.json` inclui `src/main.ts` **e** `src/db/migrate.ts`, então o
  build gera `dist/main.js` e `dist/db/migrate.js`.
- `Dockerfile.core` copia `tsconfig.build.json` e `nest-cli.json` para o estágio
  de build.
- `entrypoint.sh` passou a executar `node dist/main.js` depois das migrations.

### Dependências

- `package-lock.json` regenerado.
- `@nestjs/mau` removido (resolve as duas HIGH de `tmp` e `undici`).
- Scripts de banco adicionados: `db:generate`, `db:migrate`, `db:push`,
  `db:studio`.
- Script de deploy do Nest CLI (`nest deploy`) removido.
- `tsx` adicionado como devDependency, usado pelo runner de testes.

### Testes

Os testes de rota deixaram de montar um app Hono e passaram a usar
`Test.createTestingModule` + `supertest`:

- `test/routes/messages.test.ts`
- `test/routes/suggestions.test.ts`
- `test/app.e2e-spec.ts` (agora cobre `GET /health/live`)

Cenários preservados: 401 sem Bearer, 401 para subject malformado, 400 para
corpo/config inválidos e 400 para JSON inválido.

---

## Verificação

Executado em `apps/chat-back`, com o lockfile regenerado:

```powershell
npm ci
npm run typecheck
npm test
npm run test:e2e
npm run build
npm audit --audit-level=high
```

| Verificação                     | Resultado                                        |
| ------------------------------- | ------------------------------------------------ |
| `npm ci`                        | OK                                               |
| `npm run typecheck`             | OK                                               |
| `npm test`                      | 95 testes, 95 passando                           |
| `npm run test:e2e`              | 1 teste, 1 passando                              |
| `npm run build`                 | OK — `dist/main.js` e `dist/db/migrate.js`       |
| `npm audit --audit-level=high`  | exit 0 (sem HIGH/CRITICAL)                       |
| Prettier (`prettier --check .`) | OK                                               |
| Smoke local de `dist/main.js`   | `/health/live` = 200; `/health` = 200 `degraded` |

### Checks da PR #97

| Check                                  | Resultado                       |
| -------------------------------------- | ------------------------------- |
| Backend (chat-back)                    | ✅ SUCCESS                      |
| Frontend (chat-omnia)                  | ✅ SUCCESS                      |
| Formatação (Prettier)                  | ✅ SUCCESS                      |
| Imagens Docker                         | ✅ SUCCESS                      |
| npm audit (apps/chat-back)             | ✅ SUCCESS                      |
| npm audit (.) / chat-omnia / knowledge | ✅ SUCCESS                      |
| Trivy filesystem scan                  | ✅ SUCCESS                      |
| Semgrep CE SAST                        | ✅ SUCCESS                      |
| CI OK                                  | ✅ SUCCESS                      |
| Dependency review / CodeQL             | ⏭️ SKIPPED (configuração atual) |

Estado final da PR: `OPEN`, `MERGEABLE`, `mergeStateStatus: CLEAN`.

---

## Decisões e justificativas

1. **Portar as rotas em vez de apagar a API.** O Nest era só Hello World; apagar
   o Hono sem portar deixaria o backend sem endpoints.
2. **Preservar repositórios, domínio e providers.** A migração é de camada HTTP,
   não de regra de negócio. Drizzle, PostgreSQL e AI continuam iguais.
3. **Manter `@Res()` nos controllers.** Evita reescrever o contrato de status e
   corpo e mantém o comportamento idêntico ao das rotas Hono.
4. **Build explícito com `-p tsconfig.build.json`.** Elimina a dependência do
   default do Nest CLI e garante que só o grafo de produção seja compilado.
5. **Incluir `src/db/migrate.ts` no build.** O entrypoint do container depende de
   `dist/db/migrate.js`.
6. **Remover `@nestjs/mau` em vez de forçar downgrade do Nest.** A ferramenta é
   opcional e era a origem das vulnerabilidades HIGH.
7. **Testes em Nest + supertest.** Manter Hono só para os testes contradiria o
   objetivo da migração.

---

## Mudanças de comportamento conhecidas

- **JSON inválido:** o Hono respondia `400` com
  `{ "success": false, "error": "JSON inválido no corpo da requisição" }`.
  No Nest/Express, o parser responde `400` antes do controller, com o corpo
  padrão do framework. O status é o mesmo; a mensagem não. Nenhum teste depende
  mais do texto antigo. Se o frontend depender dessa mensagem, é preciso um
  filtro/middleware para normalizar.
- **Log de requisições:** o middleware `logger()` do Hono não foi portado.
- **Vulnerabilidades moderadas:** restam 6 moderadas em dependências de
  desenvolvimento (`@nestjs/cli` → `minimatch`; `drizzle-kit` → `esbuild`).
  Ficam abaixo do limite `--audit-level=high` da CI.

---

## Riscos e limitações

- O `docker build` não foi executado localmente porque o daemon do Docker não
  estava ativo. A imagem foi validada pelo check **Imagens Docker** na CI.
- O smoke local validou o boot do Nest e os endpoints de health, mas não exerceu
  as rotas que dependem de Postgres, OIDC e provider de AI.
- O container usa `node:26-alpine`; a CI usa Node 24. O `npm ci` e o build foram
  validados em ambos os caminhos (local e job de imagem).

---

## Como executar localmente

```powershell
cd apps/chat-back
npm ci
npm run start:dev
```

Variáveis relevantes:

| Variável            | Uso                                              |
| ------------------- | ------------------------------------------------ |
| `CORE_PORT`         | Porta do servidor (padrão `80`; local use outra) |
| `CORS_ORIGINS`      | Origens permitidas, separadas por vírgula        |
| `DATABASE_URL`      | Conexão PostgreSQL usada por Drizzle             |
| `OIDC_ISSUER`       | Issuer esperado no JWT                           |
| `OIDC_AUDIENCE`     | Audience esperada no JWT                         |
| `OIDC_JWKS_URL`     | URL do JWKS                                      |
| `OIDC_TENANT_CLAIM` | Claim do tenant (padrão `tenant_id`)             |

---

## Rollback

O rollback é o revert do commit `9a33b88` na branch da PR #97:

```powershell
git revert 9a33b88
```

Em produção, o rollback operacional é voltar a imagem anterior no Portainer
(tag por SHA), já que o deploy usa tags imutáveis.

---

## Próximos passos

1. Revisar e mesclar a PR #97.
2. Após o merge, confirmar que as menções a Hono em `docs/README.md`,
   `docs/contexto/CONTEXTO_MODELO.md` e `README.md` refletem o Nest (a PR #97 já inclui
   essas atualizações).
3. Avaliar a adoção de `@nestjs/terminus` para health checks, se o projeto
   passar a usar probes do Kubernetes/Swarm.
4. Se o frontend depender da mensagem de JSON inválido, normalizar a resposta
   com um filtro de exceção.
5. Acompanhar as vulnerabilidades moderadas de `@nestjs/cli` e `drizzle-kit`.
