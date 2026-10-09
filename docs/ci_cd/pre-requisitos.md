# Pré-requisitos

O que precisa existir antes do primeiro deploy. Uma vez só, por máquina.

## Checklist

```
[ ] Docker instalado no servidor
[ ] Postgres rodando (container omnia-postgres)
[ ] Rede externa omnia-db criada e com o Postgres conectado
[ ] /srv/omnia/homolog e /srv/omnia/prod com .env
[ ] compose e deploy.sh no diretório de cada ambiente
[ ] docker login no ghcr.io feito na VM
[ ] secrets no repositório GitHub
[ ] ambientes homolog e production criados
[ ] cd.yml presente na branch padrão
```

## 1. O banco

O banco **não é criado pelo deploy**. Ele já existe na VM e é gerenciado pelo
Portainer. O compose só se conecta a ele.

```mermaid
flowchart LR
    subgraph REDE [rede externa omnia-db]
        DB[(omnia-postgres)]
    end
    C[core] --> DB
    M[migrate-core] --> DB
```

Consequência prática: **o compose do deploy não tem serviço `postgres`**. Se
tivesse, subiria um banco novo e vazio, com volume separado, e o Core passaria a
falar com ele em vez do real.

### Conectar à rede externa

```bash
sudo docker network create omnia-db
sudo docker network connect --alias postgres omnia-db omnia-postgres
```

O `--alias postgres` é obrigatório. Sem ele, o Core resolve o host pelo nome de
container, que nem sempre é o nome do serviço no compose.

```bash
docker inspect omnia-postgres \
  --format '{{range $k,$v := .NetworkSettings.Networks}}{{$k}} -> {{json $v.Aliases}}{{println}}{{end}}'
```

Esperado:

```
omnia-db -> ["postgres"]
```

### Recriar o Postgres exige reconectar

Se o container do banco for recriado pelo Portainer, ele sai da rede externa:

```bash
sudo docker network connect --alias postgres omnia-db omnia-postgres
```

## 2. Os diretórios de ambiente

```bash
sudo mkdir -p /srv/omnia/homolog /srv/omnia/prod
sudo chown -R $USER:$USER /srv/omnia
```

O `chown` importa: `sudo mkdir` cria a pasta com o grupo do pai, e sem isso o
`scp` conecta mas não consegue escrever.

## 3. O `.env` de cada ambiente

Um arquivo por ambiente, **fora do git**.

Variáveis, e de onde vem cada uma:

| Variável            | Valor                                 | Por quê                                 |
| ------------------- | ------------------------------------- | --------------------------------------- |
| `IMAGE_CORE`        | `ghcr.io/healthdevio/chat-core:main`  | reescrita pelo `deploy.sh`              |
| `IMAGE_WEB`         | `ghcr.io/healthdevio/chat-omnia:main` | idem                                    |
| `OMNIA_DB_NETWORK`  | `omnia-db`                            | rede externa compartilhada              |
| `WEB_PORT`          | `8080` homolog · `80` prod            | as stacks convivem na mesma VM          |
| `POSTGRES_DB`       | `omnia`                               | o banco existente                       |
| `POSTGRES_USER`     | `omnia_user`                          | idem                                    |
| `POSTGRES_PASSWORD` | a senha do banco                      | **tem que ser a que o Postgres aceita** |
| `AI_PROVIDER`       | `echo`                                | texto fixo, sem gastar cota             |
| `NVIDIA_*`          | —                                     | só ao ativar `nvidia`                   |

A senha errada deixa o Core com `database: "down"` no health check, **enquanto o
nginx responde 200**. A interface parece funcionar e o problema só aparece no
health check.

Confirmar que o compose entendeu tudo:

```bash
docker compose --env-file .env -f docker-compose.deploy.yml config
```

Sai com código 0 e sem senha vazia.

## 4. Login no registry

As imagens são privadas (o repositório é privado). Estar na rede não basta.

```bash
nano /tmp/tok
# cola o token, Ctrl+O, Enter, Ctrl+X

docker login ghcr.io -u USUARIO --password-stdin < /tmp/tok
rm /tmp/tok
```

**Sem `sudo`**: o `deploy.sh` roda como `ubuntu`, que já está no grupo `docker`.
Com `sudo`, a credencial vai para `/root/.docker/` e o deploy não a encontra.

O token precisa do escopo `read:packages`, em **Settings → Developer settings →
Personal access tokens (classic)**.

## 5. Secrets no GitHub

Em **Settings → Secrets and variables → Actions**.

| Secret           | Valor                         |
| ---------------- | ----------------------------- |
| `DEPLOY_SSH_KEY` | a chave privada que abre a VM |
| `DEPLOY_HOST`    | `167.126.20.64`               |
| `DEPLOY_USER`    | `ubuntu`                      |

A chave privada precisa manter o formato PEM:

```
-----BEGIN RSA PRIVATE KEY-----
...
-----END RSA PRIVATE KEY-----
```

## 6. Ambientes

Em **Settings → Environments**.

| Ambiente     | Proteção                              |
| ------------ | ------------------------------------- |
| `homolog`    | nenhuma                               |
| `production` | `Selected branches and tags` → `main` |

## 7. O `cd.yml` na branch padrão

O passo mais fácil de esquecer. `workflow_run` e `workflow_dispatch` só
enxergam workflows presentes na branch padrão do repositório, que é a `main`.

Se o `cd.yml` ficar preso na `develop`, o CD não dispara **e não dá erro**.
Conferir:

```bash
git ls-tree -r --name-only main -- .github/workflows
```

Tem que listar `ci.yml` e `cd.yml`.

## Antes de produção

O que ainda não está resolvido, em ordem de urgência:

| Pendência                   | Por quê                                                 |
| --------------------------- | ------------------------------------------------------- |
| Rotacionar o token do ghcr  | credencial usada em ambiente compartilhado              |
| Fechar as portas expostas   | banco, CloudBeaver e Portainer estão na internet aberta |
| Remover o `.env` versionado | senha no histórico do git                               |
| HTTPS                       | hoje é HTTP puro                                        |
| Conectar o frontend à API   | a tela ainda usa estado local, não chama o Core         |

## Documentos relacionados

| Documento                      | Assunto              |
| ------------------------------ | -------------------- |
| [publicacao.md](publicacao.md) | build e publicação   |
| [deploy.md](deploy.md)         | o que acontece na VM |
| [operacao.md](operacao.md)     | verificar e reverter |
