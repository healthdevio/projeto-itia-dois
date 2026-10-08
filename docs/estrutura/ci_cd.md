# Pipeline de CI/CD

Estado atual, em outubro de 2026. O que está pronto, o que está rodando e o
que falta.

## Onde cada coisa está

| Onde                    | O quê                            | Estado                  |
| ----------------------- | -------------------------------- | ----------------------- |
| `develop` local         | trabalho de CI/CD, não commitado | pronto para review      |
| GitHub Actions          | `ci.yml`                         | escrito, nunca executou |
| GitHub Actions          | `cd.yml`                         | **não existe**          |
| VM `167.126.20.64`      | Postgres, CloudBeaver, Portainer | rodando                 |
| VM `/srv/omnia/homolog` | `.env` + compose + `deploy.sh`   | **pronto**              |
| VM `/srv/omnia/prod`    | `.env` + compose + `deploy.sh`   | **pronto**              |
| ghcr.io                 | imagens do Omnia                 | **não existem**         |

## Documentos

| Documento                    | Conteúdo                                   |
| ---------------------------- | ------------------------------------------ |
| [ci.md](ci.md)               | Os 4 jobs da CI e o que cada um valida     |
| [docker.md](docker.md)       | Imagens, compose de deploy, nginx          |
| [ambientes.md](ambientes.md) | Os 3 `.env`, rede externa, senhas          |
| [deploy.md](deploy.md)       | Passo a passo na VM, diagnóstico, rollback |
| [testes.md](testes.md)       | A suíte do Core: o que cobre e o que não   |

## O que já está pronto na VM

A preparação do servidor foi feita e verificada:

- `.env` criado em homolog e prod
- `docker-compose.deploy.yml` e `deploy.sh` copiados
- Permissões corrigidas: `sudo chown -R $USER:$USER /srv/omnia`
- Rede externa `omnia-db` criada, com o `omnia-postgres` conectado

O `docker compose config` sai com código 0 e resolve a senha corretamente.

## O que impede o deploy

**As imagens não existem.** `ghcr.io/healthdevio/chat-core:main` nunca foi
publicada. O `deploy.sh` falha no `pull` com `manifest unknown` até o `cd.yml`
construir e publicar.

Nome das imagens, já decidido:

```
ghcr.io/healthdevio/chat-core
ghcr.io/healthdevio/chat-omnia
```

## O que o `cd.yml` vai fazer

Não escrito ainda. O desenho:

```
push em develop ──> build ──> push ──> deploy homolog (automático)
push em main    ──> build ──> push ──> deploy prod (aprovação manual)
```

Precisa de:

- **`packages: write`** no `GITHUB_TOKEN`, para publicar no ghcr.io
- **Chave privada do repositório** (`core.chat-core`, `core.chat-web`) para o
  login no ghcr.io
- **Chave SSH de deploy** nos secrets, para alcançar a VM
- **Environment `production`** com required reviewer, para a aprovação manual

O acesso SSH já funciona: a chave em
`C:\Users\Alec\Downloads\ssh-key-2026-09-22.key` está em
`~/.ssh/authorized_keys` na VM, e `ssh ubuntu@167.126.20.64` responde.

## O banco na VM

|                |                                     |
| -------------- | ----------------------------------- |
| Container      | `omnia-postgres`                    |
| Imagem         | `pgvector/pgvector:pg16`            |
| Volume         | `ubuntu_omnia_postgres_data`        |
| Gerenciado por | Portainer (não pelo compose)        |
| Porta pública  | `0.0.0.0:3000`                      |
| Estado         | **vazio** — nenhuma tabela do Omnia |

As migrations do Drizzle nunca rodaram lá; o primeiro deploy cria o schema.

## Pendências conhecidas

- **`develop` remoto já foi atualizado** com `chore(core): remove all source
comments` (2.013 linhas em 21 arquivos). O trabalho de CI/CD foi reaplicado
  por cima sem conflito.
- **`omnia-postgres` está publicado na internet** (`0.0.0.0:3000`). Mesma coisa
  para o CloudBeaver (8978) e o Portainer (8000). Fechar é `ports` → `expose`
  no Portainer.
- **A senha do banco é a mesma do dev local**, e apareceu em print de tela nesta
  conversa. Ver [ambientes.md](ambientes.md).
- **`apps/packages/knowledge/.env` está versionado**, com senha dentro. Anterior
  a este trabalho.
