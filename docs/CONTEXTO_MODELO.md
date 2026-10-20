# Guia de Contexto e Regras do Projeto — Chat Omnia

**Data:** 2026-10-20  
**Projeto:** Chat Omnia — Monorepo React + Hono + PostgreSQL + Swarm  
**Repositório:** `healthdevio/projeto-itia-dois`  
**Branch principal:** `main` | **Branch de desenvolvimento:** `develop`  
**Remote:** `itia` (GitHub)

---

## 1. Fluxo de Trabalho Obrigatório (Git)

### Fluxo Obrigatório para Qualquer Commit

```bash
# 1. Sempre partir de develop atualizado
git checkout develop
git pull

# 2. Criar branch feature a partir de develop
git checkout -b feat/nome-da-tarefa

# 3. Fazer as alterações
# ... editar arquivos ...

# 4. Adicionar e commitar
git add .
git commit -m "tipo: descrição clara em português"

# 5. Push para o remote
git push -u itia feat/nome-da-tarefa
```

### Regras de Commit

| Regra                                       | Descrição                                                                   |
| ------------------------------------------- | --------------------------------------------------------------------------- |
| **Nunca commitar sozinho**                  | Só faz `git commit` / `git push` com autorização explícita do usuário       |
| **Explicar antes**                          | Antes de `git add` / `commit`, mostre: quais arquivos, o que mudou, por que |
| **Branch sempre da `develop`**              | `git checkout develop && git pull` antes de criar branch                    |
| **Remote é `itia`**                         | `git push -u itia feat/...` (não `origin`, não `itia2`)                     |
| **Mensagem no padrão Conventional Commits** | `tipo: descrição em português` (ex: `feat: adiciona health check`)          |

### Tipos de Commit Aceitos

| Tipo        | Uso                                          |
| ----------- | -------------------------------------------- |
| `feat:`     | Nova funcionalidade                          |
| `fix:`      | Correção de bug                              |
| `docs:`     | Documentação                                 |
| `refactor:` | Refatoração sem mudança de comportamento     |
| `chore:`    | Tarefas de manutenção, configs, dependências |
| `style:`    | Formatação, whitespace, sem mudança lógica   |
| `test:`     | Adição/alteração de testes                   |

---

## 2. Regras de Código e Estilo

### Comentários no Código

| Regra                                       | Explicação                                                                         |
| ------------------------------------------- | ---------------------------------------------------------------------------------- |
| **Zero comentários explicativos no código** | Comentários que explicam "porquê" vão para `docs/`                                 |
| **Comentários permitidos**                  | Apenas: shebang (`#!/bin/sh`), TODOs com issue number, anotações de tipo complexas |
| **Documentação de decisões**                | Vai para `docs/comments-archive/` ou `docs/ci_cd/decisoes.md`                      |
| **Comentários em inglês**                   | **PROIBIDO** — todo comentário e documentação em **português**                     |

### Formatação

| Ferramenta | Comando                                                      |
| ---------- | ------------------------------------------------------------ |
| Prettier   | `npm run format` (escreve) / `npm run format:check` (valida) |
| Lint       | `npm run lint` (frontend)                                    |
| TypeCheck  | `npm run typecheck` (Core + Frontend)                        |

### Commits

| Regra                      | Detalhe                                             |
| -------------------------- | --------------------------------------------------- |
| **Separados por natureza** | Testes ≠ Infra ≠ Docs ≠ Features                    |
| **Mensagem explicativa**   | Título curto + corpo explicando "o que" e "por que" |
| **Sem BOM/UTF-8 issues**   | Usar `UTF8Encoding($false)` no PowerShell           |

---

## 3. Estrutura de Documentação (`docs/`)

```
docs/
├── README.md                    # Índice geral
├── PROCESSO_MIGRACAO.md         # Histórico da migração Oracle → PW2C
├── changelog/
│   ├── CHANGELOG.md
│   └── Remocao_comentarios.md
├── ci_cd/
│   ├── README.md                # Índice CI/CD
|   |-- decisoes.md              # 12 decisões arquiteturais
|   |-- deploy.md                # Processo de deploy
|   |-- operacao.md              # Verificação, diagnóstico, rollback
|   |-- pre-requisitos.md        # Checklist pré-deploy
|   |-- publicacao.md            # Build + push de imagens
|   |-- visao-geral.md           # Fluxo push → CI → CD
|   |-- problemas/               # Catálogo de problemas por sintoma
|   |   |-- README.md
|   |   |-- problemas.md
|   |-- troca-de-servidor/       # Documentação da migração Oracle→PW2C
|   |   |-- README.md
|   |   |-- migracao.md
├── core/                        # Documentação do Core (backend)
│   ├── README.md
│   ├── ChatConfig.md
│   ├── Conversation.md
│   ├── Message.md
│   ├── Suggestion.md
│   ├── drizzle-config-drizzle-config-ts.md
│   ├── migrate-ts-tratamento-erro.md
│   └── ai-context-ts-copia-comentario.md
├── estrutura/                   # Arquitetura geral
│   ├── README.md
│   ├── ci.md
│   ├── docker.md
│   ├── ambientes.md
│   ├── config_github.md
│   ├── docker.md
│   ├── fluxo_de_versionamento.md
│   └── testes.md
├── interface/                   # Documentação do Frontend
│   ├── README.md
│   ├── botao_flutuante.md
│   ├── chat_expandido.md
│   ├── configuracao_ambiente.md
│   ├── estados_visuais.md
│   ├── estrutura_componentes.md
│   ├── mensagens_e_envio.md
│   ├── mini_chat.md
│   └── sugestoes_e_historicos.md
├── interface/                   # Documentação da Interface
│   ├── botao_flutuante.md
│   ├── chat_expandido.md
│   ├── configuracao_ambiente.md
│   ├── estados_visuais.md
│   ├── estrutura_componentes.md
│   ├── mensagens_e_envio.md
│   ├── mini_chat.md
│   └── sugestoes_e_historicos.md
├── ci_cd/                       # Documentação CI/CD
│   ├── README.md
│   ├── decisoes.md
│   ├── deploy.md
│   ├── operacao.md
│   ├── pre-requisitos.md
│   ├── publicacao.md
│   ├── visao-geral.md
│   ├── problemas/
│   │   ├── README.md
│   │   └── problemas.md
│   └── troca-de-servidor/
│       ├── README.md
│       └── migracao.md
├── core/                        # Documentação do Core
│   ├── README.md
│   ├── ChatConfig.md
│   ├── Conversation.md
│   ├── Message.md
│   ├── Suggestion.md
│   ├── drizzle-config-drizzle-config-ts.md
│   ├── migrate-ts-tratamento-erro.md
│   └── ai-context-ts-copia-comentario.md
├── testes/                      # Comentários removidos de testes
│   ├── chat-config-test-separador-log.md
│   ├── identity-test-tenant-persona.md
│   ├── messages-test-estrategia.md
│   └── suggestions-test-estrategia.md
├── changelog/
│   ├── CHANGELOG.md
│   └── Remocao_comentarios.md
├── changelog/
├── estrutura/
├── interface/
└── PROCESSO_MIGRACAO.md
```

---

## 4. Arquitetura e Decisões Técnicas

### Stack Principal

| Camada             | Tecnologia                                                   |
| ------------------ | ------------------------------------------------------------ |
| **Frontend**       | React 19, Vite 8, Tailwind 4, TypeScript                     |
| **Backend (Core)** | Hono, Node 22, TypeScript, Drizzle ORM                       |
| **Banco**          | PostgreSQL 16 + pgvector, Drizzle ORM                        |
| **IA**             | NVIDIA NIM (compatível OpenAI) + provider `echo` para testes |
| **Infra**          | Docker, Docker Compose, GitHub Actions, Swarm, Portainer CE  |
| **Registry**       | `registry.cloud.grupopw2c.com.br` (privado)                  |

### Decisões Arquiteturais Principais (de `docs/ci_cd/decisoes.md`)

| #   | Decisão                         | Motivo                                        |
| --- | ------------------------------- | --------------------------------------------- |
| 1   | API Portainer em vez de webhook | Webhook de stack é Business Edition; CE = 404 |
| 2   | `PUT` reenvia compose inteiro   | PUT substitui; corpo vazio apaga stack        |
| 3   | `.Env` da stack vai inteiro     | Senha do Postgres vive no Env, não no compose |
| 4   | Postgres preso ao `compute01`   | Volume local; banco que muda de nó sobe vazio |
| 5   | `replicas: 1` no Core           | Migration roda no start; 2 tasks = colisão    |
| 6   | Migration no `entrypoint.sh`    | Swarm: serviço perpétuo + sem `depends_on`    |
| 6   | Sem healthcheck na stack        | Quem conta é o da imagem                      |
| 7   | Senha como variável com `:?`    | Uma fonte só; Swarm recusa stack se faltar    |
| 8   | `platforms: linux/amd64`        | Cluster é amd64                               |
| 9   | Cache GHA `mode=max`            | `npm ci` é etapa lenta                        |
| 9   | Três tags por imagem            | Branch=deploy, sha=rollback, latest=inspeção  |

---

## 5. Pipeline CI/CD

### CI (`.github/workflows/ci.yml`)

| Job        | Valida                                      |
| ---------- | ------------------------------------------- |
| `frontend` | typecheck, lint, build do `chat-omnia`      |
| `core`     | typecheck, 95 testes, build do `chat-core`  |
| `format`   | prettier em todo repo                       |
| `images`   | `docker build` dos 2 Dockerfiles (sem push) |

**Gatilhos:** `push` e `pull_request` para `develop` e `main`

### CD (`.github/workflows/cd.yml`)

| Etapa             | Ação                                                                |
| ----------------- | ------------------------------------------------------------------- |
| **Trigger**       | `push` em `main`                                                    |
| **Build**         | `docker build-push-action` para `chat-core` e `chat-web`            |
| **Registry**      | `registry.cloud.grupopw2c.com.br` (credenciais `PW2C_REGISTRY_*`)   |
| **Deploy**        | **NÃO automático** — apenas publica imagens                         |
| **Deploy manual** | Atualizar `.Env` no Portainer → `Update the stack` + `Repull image` |

### Secrets Necessários (GitHub Settings → Secrets → Actions)

| Secret                   | Descrição                                        |
| ------------------------ | ------------------------------------------------ |
| `PW2C_REGISTRY_USERNAME` | Usuário do registry da empresa                   |
| `PW2C_REGISTRY_PASSWORD` | Senha/token do registry                          |
| `PORTAINER_URL`          | `https://portainer.empresa.com.br`               |
| `PORTAINER_API_KEY`      | Token de acesso do Portainer (escopo: stacks)    |
| `PORTAINER_STACK_ID`     | ID da stack `omnia` (da URL: `/#!/stacks/1/...`) |
| `PORTAINER_ENDPOINT_ID`  | ID do endpoint Swarm (geralmente `1`)            |

---

## 6. Stack de Deploy (Swarm)

### Arquivo: `apps/docker/pw2c/docker-stack.yml`

| Serviço    | Imagem                   | Porta           | Replicas | Constraint                   |
| ---------- | ------------------------ | --------------- | -------- | ---------------------------- |
| `postgres` | `pgvector/pgvector:pg16` | —               | 1        | `node.hostname == compute01` |
| `core`     | `${OMNIA_CORE_IMAGE}`    | 3001 (internal) | 1        | —                            |
| `web`      | `${OMNIA_WEB_IMAGE}`     | 8080 (host)     | 1        | —                            |

### Variáveis de Ambiente (`.Env` da stack no Portainer)

| Variável            | Obrigatória | Exemplo                                            |
| ------------------- | ----------- | -------------------------------------------------- |
| `OMNIA_CORE_IMAGE`  | ✅          | `registry.cloud.grupopw2c.com.br/chat-core:latest` |
| `OMNIA_WEB_IMAGE`   | ✅          | `registry.cloud.grupopw2c.com.br/chat-web:latest`  |
| `OMNIA_WEB_PORT`    | ✅          | `8080`                                             |
| `POSTGRES_DB`       | ✅          | `omnia`                                            |
| `POSTGRES_USER`     | ✅          | `omnia_user`                                       |
| `POSTGRES_PASSWORD` | ✅          | **senha real**                                     |
| `AI_PROVIDER`       | —           | `echo`                                             |
| `NVIDIA_API_KEY`    | —           | (vazio para `echo`)                                |
| `NVIDIA_MODEL`      | —           | `meta/llama-3.3-70b-instruct`                      |
| `NVIDIA_BASE_URL`   | —           | `https://integrate.api.nvidia.com/v1`              |
| `NVIDIA_TIMEOUT_MS` | —           | `300000`                                           |
| `NVIDIA_MAX_TOKENS` | —           | `400`                                              |

### Segredos do Swarm (criar uma vez no servidor)

```bash
printf 'senha-real' | docker secret create postgres_password -
printf '' | docker secret create nvidia_api_key -
```

---

## 7. Regras de Desenvolvimento

### Core (`apps/chat-core/`)

| Comando             | Ação                          |
| ------------------- | ----------------------------- |
| `npm run dev`       | Hot reload com tsx            |
| `npm run build`     | `tsc`                         |
| `npm run test`      | 95 testes (node:test via tsx) |
| `npm run typecheck` | `tsc --noEmit` (src + test)   |
| `npm run migrate`   | Aplica migrations Drizzle     |

### Frontend (`apps/chat-omnia/`)

| Comando             | Ação                   |
| ------------------- | ---------------------- |
| `npm run dev`       | Vite dev server        |
| `npm run build`     | `tsc -b && vite build` |
| `npm run lint`      | ESLint                 |
| `npm run typecheck` | `tsc -b`               |
| `npm run preview`   | Serve `dist/`          |

### Raiz do Monorepo

| Comando                | Ação                 |
| ---------------------- | -------------------- |
| `npm run format`       | `prettier --write .` |
| `npm run format:check` | `prettier --check .` |

---

## 8. Endpoints da API (Core)

| Método | Rota                         | Descrição                                    |
| ------ | ---------------------------- | -------------------------------------------- |
| `GET`  | `/`                          | Health check (`{status, service, database}`) |
| `GET`  | `/health`                    | Health completo                              |
| `GET`  | `/health/ready`              | Readiness probe (200/503)                    |
| `GET`  | `/health/live`               | Liveness probe                               |
| `GET`  | `/api/conversations/current` | Conversa ativa do usuário                    |
| `GET`  | `/api/conversations/active`  | ID da conversa ativa                         |
| `POST` | `/api/conversations/rotate`  | Encerra e abre nova conversa                 |
| `POST` | `/api/messages`              | Envia mensagem, recebe resposta + sugestões  |
| `GET`  | `/api/suggestions`           | Sugestões da conversa ativa                  |

**Autenticação:** Header `X-User-Id` (obrigatório), `X-Tenant-Id` (opcional)

---

## 9. Health Checks

| Endpoint            | Descrição                               | Uso                        |
| ------------------- | --------------------------------------- | -------------------------- |
| `GET /health`       | Health completo (status, DB, timestamp) | Monitoramento geral        |
| `GET /health/ready` | Readiness probe (200/503)               | Kubernetes/Swarm readiness |
| `GET /health/live`  | Liveness probe (200)                    | Kubernetes/Swarm liveness  |

**No Frontend:** Hook `useHealthCheck` faz polling a cada 30s em `/health` e exibe `HealthIndicator` (badge verde/vermelho no canto inferior direito).

---

## 10. Regras de Não-Fazer (O que NÃO fazer)

| ❌ Não Faça                               | ✅ Faça                                        |
| ----------------------------------------- | ---------------------------------------------- |
| Comentários em inglês no código           | Comentários em português (ou zero comentários) |
| Comentários explicando "porquê" no código | Documente em `docs/`                           |
| Commitar direto na `main`                 | Sempre via PR `develop` → `main`               |
| Push sem autorização                      | Peça permissão antes de `git push`             |
| Commit misto (feat + fix + docs)          | Commits separados por natureza                 |
| Hardcoded secrets no código               | Use secrets do GitHub / Docker secrets         |
| Hardcode URLs/IPs no código               | Use variáveis de ambiente                      |
| Push sem rodar testes                     | `npm run format:check && npm test` antes       |
| Editar `main` diretamente                 | Sempre via branch + PR                         |
| Deixar `console.log` em produção          | Use `console.debug` ou logger estruturado      |

---

## 11. Checklist Pré-Deploy (Antes de Merge para Main)

- [ ] Stack `omnia` criada no Portainer com `docker-stack.yml`
- [ ] `Environment variables` preenchidas no Portainer (`POSTGRES_PASSWORD`, tags, etc.)
- [ ] 6 secrets no GitHub (2 registry + 4 Portainer)
- [ ] Nó `compute01` confirmado no Swarm (`docker node ls`)
- [ ] SSL/HTTPS configurado no Load Balancer / Ingress
- [ ] Secrets do cluster criados (`postgres_password`, `nvidia_api_key`)
- [ ] `docker network create omnia-net` (overlay) no cluster
- [ ] CI/CD passing no GitHub Actions

---

## 12. Rollback

| Cenário              | Ação                                                                                  |
| -------------------- | ------------------------------------------------------------------------------------- |
| **Código**           | No Portainer: `OMNIA_CORE_IMAGE` / `OMNIA_WEB_IMAGE` → sha anterior → Update + Repull |
| **Banco (migração)** | Drizzle não tem `down`. Rollback = restaurar volume do Postgres                       |
| **Imagem quebrada**  | Apontar tags para sha anterior no Portainer → Update + Repull                         |

---

## 13. Troubleshooting Rápido

| Sintoma                                   | Causa Provável                       | Solução                                                   |
| ----------------------------------------- | ------------------------------------ | --------------------------------------------------------- |
| `manifest unknown`                        | Imagem não publicada                 | Verificar CI/CD → Build and Push                          |
| `unauthorized` no pull                    | Credencial divergente                | Conferir secrets GitHub = cluster                         |
| `no matching manifest linux/amd64`        | Build sem platform                   | `platforms: linux/amd64` no workflow                      |
| `web` 502                                 | Core não subiu                       | `docker service logs omnia_core`                          |
| `core` reiniciando                        | Banco fora ou senha errada           | Log do Core + conferir `POSTGRES_PASSWORD`                |
| `relation "conversations" does not exist` | Postgres em nó errado                | `docker service ps omnia_postgres` → deve ser `compute01` |
| `constraint requirements not satisfied`   | Nó `compute01` não existe            | `docker node ls` + ajuste constraint                      |
| Workflow verde mas app não mudou          | `OMNIA_CORE_IMAGE` ausente no `.Env` | Adicionar no Portainer                                    |

---

## 13. Contatos e Referências

| Recurso          | Link                                                      |
| ---------------- | --------------------------------------------------------- |
| Repositório      | `https://github.com/healthdevio/projeto-itia-dois`        |
| Registry         | `registry.cloud.grupopw2c.com.br`                         |
| Portainer        | `https://portainer.empresa.com.br`                        |
| Domínio produção | `https://projeto-itia-dois.cloud.grupopw2c.com.br`        |
| Health check     | `https://projeto-itia-dois.cloud.grupopw2c.com.br/health` |

---

## 14. Como Atualizar Este Documento

Quando houver mudanças arquiteturais, de fluxo, de regras ou de stack:

1. Atualize este arquivo (`docs/CONTEXTO_MODELO.md`)
2. Atualize documentos relacionados em `docs/`
3. Commite com `docs: atualiza guia de contexto`
4. Push para `develop` → PR → merge para `main`

---

**Última atualização:** 2026-10-20  
**Versão:** 1.0  
**Mantido por:** Equipe Chat Omnia
