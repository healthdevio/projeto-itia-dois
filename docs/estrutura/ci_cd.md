# Pipeline de CI/CD

Estado atual, em outubro de 2026.

## Onde cada coisa está

| Onde                    | O quê                            | Estado                   |
| ----------------------- | -------------------------------- | ------------------------ |
| `develop`               | CI + CD, mergeados (PR #28, #29) | ativo                    |
| `main`                  | CI antiga, 1 job                 | **CD ainda não acordou** |
| GitHub Actions          | `ci.yml`, `cd.yml`               | ambos na `develop`       |
| VM `167.126.20.64`      | Postgres, CloudBeaver, Portainer | rodando                  |
| VM `/srv/omnia/homolog` | `.env` + compose + `deploy.sh`   | pronto                   |
| VM `/srv/omnia/prod`    | `.env` + compose + `deploy.sh`   | pronto                   |
| ghcr.io                 | imagens do Omnia                 | **não publicadas**       |

## Documentos

| Documento                            | Conteúdo                                   |
| ------------------------------------ | ------------------------------------------ |
| [ci.md](ci.md)                       | Os 4 jobs da CI e o que cada um valida     |
| [docker.md](docker.md)               | Imagens, compose de deploy, nginx          |
| [ambientes.md](ambientes.md)         | Os 3 `.env`, rede externa, senhas          |
| [config_github.md](config_github.md) | Secrets, ambientes e limites do plano      |
| [deploy.md](deploy.md)               | Passo a passo na VM, diagnóstico, rollback |
| [testes.md](testes.md)               | A suíte do Core: o que cobre e o que não   |

## A CI

PR #28 mergeado. Rodou pela primeira vez com os 4 jobs:

```
Frontend (chat-omnia)      24s
Core (chat-core)            32s
Formatação (prettier)      35s
Imagens Docker              53s
```

O job **Imagens Docker** é o que mais importava: os Dockerfiles foram escritos
sem nunca terem sido executados. Passou.

## O CD — primeiro movimento

PR #29 mergeado na `develop`. O `cd.yml` constrói e publica `chat-core` e
`chat-web` no `ghcr.io`, mas só depois que a CI passa.

```yaml
on:
  workflow_run: # automático, quando a CI termina com success
    workflows: ['CI (Continuous Integration)']
  workflow_dispatch: # manual, pelo botão na aba Actions
```

### Por que o CD ainda não roda

`workflow_run` e `workflow_dispatch` só funcionam se o workflow estiver na branch
padrão, que aqui é `main`. O `cd.yml` está na `develop`.

A falha é silenciosa: sem erro, sem aviso, o CD simplesmente não dispara.

```
1. PR develop → main        (cd.yml chega na branch padrão)
2. próximo push             (CD dispara e publica as imagens)
3. imagens existem          (aí o deploy na VM pode ser testado)
```

## O que falta

**Etapa 2 — o job de deploy.** Entra na VM por SSH e roda o `deploy.sh`:

```
develop ──> /srv/omnia/homolog ──> environment: homolog
main    ──> /srv/omnia/prod    ──> environment: production
```

Precisa do `docker login ghcr.io` na VM, porque as imagens são privadas — ver
[config_github.md](config_github.md).

## Estado da VM

|                |                                         |
| -------------- | --------------------------------------- |
| Container      | `omnia-postgres`                        |
| Imagem         | `pgvector/pgvector:pg16`                |
| Volume         | `ubuntu_omnia_postgres_data`            |
| Gerenciado por | Portainer (não pelo compose)            |
| Porta pública  | `0.0.0.0:3000`                          |
| Estado         | **vazio** — nenhuma tabela do Omnia     |
| Rede           | `omnia-db`, compartilhada com o compose |

## Pendências conhecidas

- **O CD não acorda até o `cd.yml` chegar na `main`.**
- **`omnia-postgres` está publicado na internet** (`0.0.0.0:3000`). Mesma coisa
  para o CloudBeaver (8978) e o Portainer (8000). Fechar é `ports` → `expose`
  no Portainer.
- **A senha do banco é a mesma do dev local**, e apareceu em print de tela. Ver
  [ambientes.md](ambientes.md).
- **`apps/packages/knowledge/.env` está versionado**, com senha dentro. Anterior
  a este trabalho.
- **A chave privada do SSH está em `Downloads`**, que é pasta sujeita a limpeza
  e antivírus. Considerar mover para `C:\Users\Alec\.ssh\`.
