# Changelog — Migração Oracle → PW2C (Swarm)

Data: 2026-10-19  
Branch: `feat/deploy-pw2c-swarm` → `develop`  
Merge: `47540cd`

---

## Resumo

| O que era                                | O que virou                               |
| ---------------------------------------- | ----------------------------------------- |
| Oracle Cloud (VM única)                  | Cluster Docker Swarm da PW2C              |
| `docker compose`                         | `docker stack` (Swarm)                    |
| `ghcr.io`                                | `registry.cloud.grupopw2c.com.br`         |
| SSH + `scp` + `deploy.sh`                | API do Portainer (token)                  |
| Postgres fora da stack (rede `omnia-db`) | Postgres **dentro da stack**              |
| `migrate-core` como serviço              | migration no `entrypoint.sh`              |
| `cd.yml` + webhook                       | `cd.yml` + API do Portainer (sem webhook) |

---

## Commits da migração

| Commit    | Tipo            | Descrição                                               |
| --------- | --------------- | ------------------------------------------------------- |
| `9553021` | `fix(core)`     | Instala `postgresql-client` no `Dockerfile.core`        |
| `1664738` | `refactor(cd)`  | Remove atualização automática da stack; só build + push |
| `fe541e8` | `docs`          | Atualiza referências ao nome do workflow                |
| `df90923` | `refactor(cd)`  | Renomeia workflow `deploy-pw2c.yml` → `cd.yml`          |
| `984f964` | `docs(ci_cd)`   | Registra a troca de servidor (2 docs)                   |
| `5846d80` | `refactor(cd)`  | Remove comentários dos arquivos; senha no `.Env`        |
| `6c20ef6` | `docs`          | Reescreve CI/CD para cluster PW2C                       |
| `e23c096` | `feat(cd)`      | Deploy no Swarm no lugar da VM                          |
| `9652698` | `chore(deploy)` | Remove pipeline da VM Oracle                            |

---

## Arquivos novos

| Arquivo                                    | Descrição                                    |
| ------------------------------------------ | -------------------------------------------- |
| `apps/docker/pw2c/docker-stack.yml`        | Stack do Swarm (Postgres, Core, Web)         |
| `apps/docker/pw2c/stack.env.example`       | Template das variáveis da stack              |
| `apps/docker/entrypoint.sh`                | Espera Postgres → migration → server         |
| `apps/docker/Dockerfile.core`              | Ganhou `postgresql-client` + `entrypoint.sh` |
| `.github/workflows/cd.yml`                 | Build + push (sem deploy da stack)           |
| `docs/ci_cd/decisoes.md`                   | 12 decisões de arquitetura                   |
| `docs/ci_cd/troca-de-servidor/README.md`   | Por que mudou, impacto, 4 decisões-chave     |
| `docs/ci_cd/troca-de-servidor/migracao.md` | Mudança por mudança (antes/depois)           |
| `apps/docker/pw2c/stack.env.example`       | Template das variáveis da stack              |

---

## Arquivos removidos

| Arquivo                                 | Motivo                        |
| --------------------------------------- | ----------------------------- |
| `.github/workflows/cd.yml` (antigo)     | Pipeline SSH + VM Oracle      |
| `apps/docker/deploy.sh`                 | Script SSH da VM              |
| `apps/docker/docker-compose.deploy.yml` | Compose da VM                 |
| `apps/docker/.env.homolog`              | Não existe mais homolog na VM |
| `apps/docker/.env.prod`                 | Não existe mais prod na VM    |

---

## Arquivos modificados (destaques)

| Arquivo                              | Mudança principal                                   |
| ------------------------------------ | --------------------------------------------------- |
| `apps/docker/Dockerfile.core`        | + `postgresql-client`; + `entrypoint.sh`            |
| `apps/docker/pw2c/docker-stack.yml`  | Stack Swarm (Postgres + Core + Web)                 |
| `apps/docker/pw2c/stack.env.example` | Template variáveis (sem secrets)                    |
| `.github/workflows/cd.yml`           | Build + push apenas; sem deploy                     |
| `.github/workflows/ci.yml`           | Inalterado                                          |
| `apps/docker/entrypoint.sh`          | Novo: espera PG → migration → server                |
| `apps/chat-omnia/README.md`          | Atualizado para registry PW2C                       |
| `README.md` (raiz)                   | Aponta para cluster PW2C                            |
| `docs/estrutura/ambientes.md`        | Reescrito: dev + cluster (sem .env de homolog/prod) |
| `docs/estrutura/config_github.md`    | Secrets do registry PW2C + Portainer                |
| `docs/estrutura/docker.md`           | Stack Swarm no lugar do compose                     |
| `docs/estrutura/README.md`           | Aponta para cluster                                 |
| `docs/ci_cd/*.md`                    | 8 docs reescritos para Swarm                        |
| `docs/ci_cd/decisoes.md`             | **Novo**: 12 decisões documentadas                  |
| `docs/ci_cd/troca-de-servidor/`      | **Novo**: 2 docs da migração                        |

---

## Decisões arquiteturais (resumo)

| Decisão                       | Motivo                                           |
| ----------------------------- | ------------------------------------------------ |
| API em vez de webhook         | Stack webhook é Business Edition; CE devolve 404 |
| `PUT` reenvia compose         | PUT substitui; corpo vazio apaga stack           |
| `Env` vai inteiro             | Senha do Postgres vive no Env                    |
| Postgres preso ao `compute01` | Volume local; banco que muda de nó sobe vazio    |
| `replicas: 1` no Core         | Migration roda no start; 2 tasks = colisão       |
| Migration no `entrypoint.sh`  | Swarm: serviço perpétuo + sem `depends_on`       |
| Sem healthcheck na stack      | Quem conta é o da imagem                         |
| Senha como variável           | Uma fonte só; `:?` obriga preenchimento          |
| `platforms: linux/amd64`      | Cluster é amd64                                  |
| Cache GHA `mode=max`          | `npm ci` é etapa lenta                           |
| Três tags por imagem          | Branch=deploy, sha=rollback, latest=inspeção     |

---

## O que ainda impede o deploy

- [ ] Stack criada no Portainer
- [ ] `Environment variables` preenchidas (`POSTGRES_PASSWORD`, tags)
- [ ] 6 secrets no GitHub (2 registry + 4 Portainer)

---

## Como testar

```bash
# 1. Merge para main dispara o CD
git checkout main
git merge develop
git push origin main

# 2. Acompanhar Actions → CD (Continuous Delivery)
# 3. No Portainer: Stacks → omnia → Environment variables
#    Atualizar OMNIA_CORE_IMAGE e OMNIA_WEB_IMAGE
#    Update the stack + Repull image
```

---

## Merge

```bash
git checkout main
git merge develop
git push origin main
```
