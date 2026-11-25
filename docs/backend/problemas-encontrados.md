# Problemas encontrados no projeto e correções aplicadas

**Data:** 23/11/2026
**Branch:** `fix/lint-ci-e-docs` (criada a partir de `develop`)
**Escopo:** verificação local de backend, frontend, infraestrutura e documentação.
**Fora deste commit:** as mudanças da Task 01 de integração com Host (código,
testes e atualizações de `HostIntegration.md`/`Definir-contrato.md`); veja
[HostIntegration-task-01-resolvido.md](HostIntegration-task-01-resolvido.md).

## 1. Resumo

| #   | Problema                                                                | Impacto                                    | Status            |
| --- | ----------------------------------------------------------------------- | ------------------------------------------ | ----------------- |
| 1   | 112 erros de `no-floating-promises` no lint do backend                  | `npm run lint` quebrado; falhas mascaradas | ✅ corrigido      |
| 2   | Warning `no-base-to-string` em `db/migrate.ts`                          | Ruído no lint                              | ✅ corrigido      |
| 3   | Nginx reescrevia `/health/ready` e `/health/live` para `/health`        | Readiness público nunca devolvia 503       | ✅ corrigido      |
| 4   | 7 links quebrados no README do `chat-omnia`                             | Navegação da documentação quebrada         | ✅ corrigido      |
| 5   | `docs/estrutura/testes.md` desatualizado                                | Números e scripts incorretos               | ✅ corrigido      |
| 6   | `apps/chat-back/README.md` era o boilerplate do NestJS                  | Sem documentação prática do backend        | ✅ corrigido      |
| 7   | `docs/backend/fluxo-git-e-contexto.md` com caminho antigo e bytes nulos | Documento ilegível/caminho inexistente     | ✅ corrigido      |
| 8   | `health-check-backend.md` apontava para `src/index.ts`                  | Caminho inexistente                        | ✅ corrigido      |
| 9   | Docs históricos diziam “95 testes”                                      | Número desatualizado (hoje 122)            | ✅ anotado        |
| 10  | `tsconfig.test.json` sem `vitest/globals`                               | Typecheck dos testes falhava no e2e        | ✅ corrigido      |
| 11  | CI usava Node 24 e Docker usava Node 26                                 | Build validado em runtime diferente        | ✅ alinhado em 26 |
| 12  | CI do backend não rodava lint                                           | 112 erros passaram despercebidos           | ✅ adicionado     |
| 13  | `docs/README.md` desformatado na base `develop`                         | `npm run format:check` falhava na raiz     | ✅ formatado      |

## 2. Lint do backend

### 2.1 Os 112 erros

Todos eram da mesma regra:

```text
typescript(no-floating-promises)
```

Distribuição: **90 chamadas `it(` e 22 chamadas `describe(`**, em 9 arquivos de
teste. Nenhum erro estava em `src/`.

| Arquivo                                   | Erros |
| ----------------------------------------- | ----- |
| `test/services/ai/prompt.test.ts`         | 21    |
| `test/models/suggestion.test.ts`          | 16    |
| `test/middleware/identity.test.ts`        | 14    |
| `test/routes/messages.test.ts`            | 13    |
| `test/models/conversation.test.ts`        | 13    |
| `test/services/ai/providers/echo.test.ts` | 11    |
| `test/models/chat-config.test.ts`         | 10    |
| `test/routes/suggestions.test.ts`         | 7     |
| `test/services/ai/context.test.ts`        | 7     |

**Causa:** `describe()` e `it()` do `node:test` devolvem `Promise<void>`. Sem
`await` nem `void`, o oxlint com `--type-aware` as trata como promessas
flutuantes.

**Por que a regra foi mantida:** um teste temporário mostrou que:

- um `it()` que rejeita sem `void` ainda falha o teste normalmente;
- uma promise flutuante **dentro** de um teste que passa gera apenas
  `unhandledRejection` e o teste termina verde.

Ou seja, a regra protege contra falha mascarada. A correção foi explícita:

```ts
void describe('...', () => {
  void it('...', async () => { ... });
});
```

O padrão já era usado em `test/services/tools/*`.

### 2.2 O warning de `migrate.ts`

Em `src/db/migrate.ts`, `String(error.cause)` em um objeto produzia
`[object Object]`. A formatação passou a tratar `Error`, string e objeto
(`JSON.stringify`) separadamente.

### 2.3 Resultado

```text
npm run lint
# exit 0, sem erros e sem warnings
```

## 3. Nginx e health check

O código do Core sempre esteve correto:

| Rota            | Comportamento esperado                        |
| --------------- | --------------------------------------------- |
| `/health`       | 200 com status agregado (pode ser `degraded`) |
| `/health/ready` | 200 com banco up; **503** com banco down      |
| `/health/live`  | sempre 200                                    |

O problema estava em `apps/docker/nginx.conf`:

```nginx
location /health {            # prefixo: captura /health/ready e /health/live
  proxy_pass $core_upstream/health;   # reescreve tudo para /health
}
```

Por isso os três endpoints públicos respondiam o mesmo payload e o readiness
perdia o 503. A correção preserva o caminho:

```nginx
location ~ ^/health(?:/ready|/live)?$ {
  proxy_pass $core_upstream$request_uri;
}
```

O comentário do topo do arquivo também foi corrigido: ele afirmava que o Core
confiava no header cru `X-User-Id`, quando hoje ele valida JWT OIDC.

> Não foi possível executar `nginx -t` localmente porque o daemon do Docker
> estava desligado. A sintaxe usa os mesmos recursos já presentes no bloco
> `/api/` (`resolver`, variável de upstream e `$request_uri`).

## 4. Documentação

### 4.1 Links do README do `chat-omnia`

O scan de links encontrou **7 links quebrados**, todos em
`apps/chat-omnia/README.md`:

| Link antigo                 | Destino correto                                          |
| --------------------------- | -------------------------------------------------------- |
| `chat_expandido.md`         | `ExpandedChat.md`                                        |
| `mini_chat.md`              | `MiniChat.md`                                            |
| `botao_flutuante.md`        | `FloatingChatButton.md`                                  |
| `mensagens_e_envio.md`      | `MessageList.md`, `MessageItem.md`, `ChatInput.md`       |
| `estados_visuais.md`        | `ChatStateView.md` (+ `LoadingIndicator.md`)             |
| `sugestoes_e_historicos.md` | `SuggestionList.md`, `HistoryPanel.md`, `HistoryItem.md` |
| `docs/core/README.md`       | `docs/backend/README.md`                                 |

Depois da correção: **0 links quebrados** no scan de toda a documentação.

### 4.2 `docs/estrutura/testes.md`

Estava descrevendo um estado antigo:

| Antes                                | Depois                                                |
| ------------------------------------ | ----------------------------------------------------- |
| “95 testes”                          | 122 testes (+ 1 e2e)                                  |
| `typecheck` com `tsconfig.test.json` | `tsc --noEmit -p tsconfig.build.json`                 |
| “`tsconfig.json` só inclui `src/**`” | Sem `include`; quem restringe é `tsconfig.build.json` |
| Exemplo sem `void`                   | Exemplo com `void describe` / `void it`               |
| Sem tools nem Host                   | Cobertura de `services/tools/*` e `host-integration`  |

### 4.3 README do backend

Era o boilerplate do NestJS. Foi reescrito com stack, requisitos, variáveis de
ambiente, endpoints, identidade OIDC, banco/migrations, scripts e estrutura.

### 4.4 `fluxo-git-e-contexto.md`

O arquivo tinha dois problemas:

- citava `apps/chat-core/src/index.ts`, pasta que não existe mais;
- terminava com bytes nulos e mistura UTF-8/UTF-16, o que fazia leitores
  tratarem o arquivo como binário.

Foi marcado como **documento histórico**, os caminhos foram atualizados para
`apps/chat-back`, e a codificação foi normalizada para UTF-8.

### 4.5 Outros ajustes

- `health-check-backend.md`: `src/index.ts` → `src/controllers/health.controller.ts`.
- `docs/backend/README.md`: adicionados `/health/ready` e `/health/live`.
- `refatoracao-hono-para-nest.md` e `troca-de-servidor/README.md`: “95 testes”
  anotado como valor da época (hoje 122).
- README do backend, `docs/estrutura/ci.md` e `docs/ci_cd/visao-geral.md`:
  Node atualizado para 26.
- `docs/README.md`: tabelas realinhadas pelo Prettier. Era o único arquivo que
  fazia `npm run format:check` falhar na base `develop`; a alteração é só de
  espaçamento.

## 5. Typecheck dos testes

`apps/chat-back/tsconfig.test.json` declarava apenas `types: ["node"]`, mas
`test/app.e2e-spec.ts` usa os globais do Vitest (`describe`, `it`, `expect`,
`beforeEach`, `afterEach`). O comando falhava com `TS2593`/`TS2304`.

Correção: `types: ["vitest/globals", "node"]`. O comando agora passa:

```bash
cd apps/chat-back
npx tsc --noEmit -p tsconfig.test.json
```

## 6. Node e CI

Detalhes em [Lint e Node no CI](../ci_cd/lint-e-node-no-ci.md). Resumo:

- CI passou de Node 24 para **26**, igual aos Dockerfiles e ao `@types/node`.
- O job de backend ganhou `npm run lint` entre typecheck e testes.
- Todos os checks foram validados sob Node 24 e Node 26.

## 7. O que não foi alterado

| Item                            | Situação                                                                                                                                     |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/chat-back/.gitattributes` | Alteração pré-existente do usuário; não foi tocada nem commitada                                                                             |
| `npm test` na raiz              | Continua sendo placeholder (`exit 1`)                                                                                                        |
| `apps/packages/knowledge`       | Continua sem scripts próprios de teste/build                                                                                                 |
| `test:e2e`                      | Continua fora do CI (roda localmente)                                                                                                        |
| Code Scanning                   | 4 alertas abertos (log injection / tainted format string em `messages.controller.ts` e ReDoS em `identity.ts`); não tratados nesta alteração |
| Task 01 (Host)                  | Código e testes permanecem no working tree, fora deste commit                                                                                |

## 8. Verificação final

| Verificação                                | Resultado          |
| ------------------------------------------ | ------------------ |
| Backend `lint`                             | exit 0             |
| Backend `typecheck`                        | exit 0             |
| Backend `tsc -p tsconfig.test.json`        | exit 0             |
| Backend `test`                             | 122/122            |
| Backend `test:e2e`                         | 1/1                |
| Backend `build`                            | exit 0             |
| Frontend `typecheck`                       | exit 0             |
| Frontend `lint`                            | exit 0             |
| Frontend `build`                           | exit 0             |
| `npm run format:check` (raiz)              | exit 0             |
| Links internos dos docs                    | 189/189            |
| `npm audit` (backend, frontend, knowledge) | 0 vulnerabilidades |

## 9. Referências

- [Lint e Node no CI](../ci_cd/lint-e-node-no-ci.md)
- [Task 01 de integração com Host](HostIntegration-task-01-resolvido.md)
- [Contrato HostIntegration](HostIntegration.md)
- [Testes automatizados](../estrutura/testes.md)
- [Integração contínua](../estrutura/ci.md)
