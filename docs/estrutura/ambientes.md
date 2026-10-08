# Ambientes

Três ambientes, três arquivos `.env`. Nenhum vai para o git.

| Ambiente        | `.env` no repo             | Vai pro git? | Porta        |
| --------------- | -------------------------- | ------------ | ------------ |
| Desenvolvimento | `apps/docker/.env`         | **não**      | 5433 (banco) |
| Homologação     | `apps/docker/homolog/.env` | **não**      | 8080         |
| Produção        | `apps/docker/prod/.env`    | **não**      | 80           |

Cada `.env` do repo é a cópia local do que vive na VM:

```
apps/docker/homolog/.env  →  /srv/omnia/homolog/.env
apps/docker/prod/.env     →  /srv/omnia/prod/.env
```

O `.gitignore` da raiz tem `.env` na linha 1, e ele cobre qualquer `.env` em
qualquer subpasta:

```console
$ git check-ignore -v apps/docker/prod/.env
.gitignore:1:.env	apps/docker/prod/.env
```

## O que versiona e o que não

```
apps/docker/.env.dev                → git   (template)
apps/docker/.env.homolog            → git   (template)
apps/docker/.env.prod               → git   (template)
apps/docker/.env                    → NUNCA git
apps/docker/homolog/.env            → NUNCA git
apps/docker/prod/.env               → NUNCA git
```

Os três templates têm `POSTGRES_PASSWORD=` **vazio**. Os `.env` reais têm o valor
da senha, e só existem na máquina de quem vai fazer o deploy — eles não são
versionados, e nem aparecem no `git status`.

Para ver a senha que o banco da VM usa:

```bash
sudo docker exec omnia-postgres printenv | grep POSTGRES_PASSWORD
```

## O banco já existe

Na VM, o container `omnia-postgres` (Portainer, volume
`ubuntu_omnia_postgres_data`) já está no ar. O compose do Omnia **não cria nem
altera** esse banco — só se conecta a ele.

Isso é o oposto do que seria sem o banco existente: subir um Postgres no compose
criaria um banco novo e vazio, com volume separado, e o Core passaria a falar com
ele em vez do real.

Estado atual do banco:

```console
$ docker exec omnia-postgres psql -U omnia_user -d omnia -c "select count(*) from conversations;"
ERROR:  relation "conversations" does not exist
```

Não é que a tabela esteja vazia: **não existe tabela nenhuma**. As migrations do
Drizzle nunca rodaram naquela VM. O primeiro deploy cria o schema.

## Senhas

O compose não cria nem altera o banco, então senha errada deixa o Core com
`database: "down"` **enquanto o nginx responde 200** — a interface parece
funcionar, e o problema só aparece no health check.

### Risco conhecido

A senha do banco da VM é a **mesma do dev local**, e apareceu em print de tela
nesta conversa. Não bloqueia o deploy. Para trocar depois:

```bash
sudo docker exec omnia-postgres psql -U omnia_user -d omnia \
  -c "ALTER USER omnia_user WITH PASSWORD '<nova>';"
```

Depois atualizar o `POSTGRES_PASSWORD` no `.env` e rodar o deploy de novo. Trocar
só o `.env` sem o `ALTER USER` não funciona: o Postgres guarda a senha em disco.

### Dev e deploy

Bancos diferentes, senhas diferentes. O dev sobe o Postgres pelo
`docker-compose.yml`; o deploy usa o da VM.

## O `.env` de desenvolvimento

`apps/docker/.env` tem **uma linha**:

```bash
POSTGRES_PASSWORD=<a senha do banco local>
```

O nome é o mesmo nos três ambientes.

### O que mudou

O compose de dev usava uma variável cujo nome era a própria senha. O Docker lê
`${nome}` como **nome de variável**, não como valor — então o `.env` precisava ter
uma linha com aquele nome exato. Sem o `.env`, a variável não existia e o
Postgres subia com senha vazia:

```console
$ docker compose config          # sem o .env
POSTGRES_PASSWORD: ""
DATABASE_URL: postgresql://omnia_user:@postgres:5432/omnia
```

O banco recusava subir, e o erro não apontava para o compose.

Agora é `${POSTGRES_PASSWORD:?...}`, que falha na hora e diz o que fazer:

```console
$ docker compose config          # sem o .env
error while interpolating services.postgres.environment.POSTGRES_PASSWORD:
required variable POSTGRES_PASSWORD is missing a value: defina POSTGRES_PASSWORD no .env
```

### A porta 5433

O compose de dev publica `5433:5432`, e o `.env.example` do `chat-core` aponta
para `localhost:5432`. Para rodar o Core contra o banco local, a URL é
`localhost:5433`:

```bash
DATABASE_URL=postgresql://omnia_user:<senha>@localhost:5433/omnia
```

## A rede externa

Os dois ambientes de deploy compartilham a rede Docker `omnia-db`, onde o
`omnia-postgres` está conectado. Criada uma vez:

```bash
sudo docker network create omnia-db
sudo docker network connect omnia-db omnia-postgres
```

Para usar outro nome:

```bash
OMNIA_DB_NETWORK=outro-nome
```

Repita o `connect` sempre que o Portainer recriar o Postgres: recriar o
container tira ele da rede.

## AI_PROVIDER

`echo` nos dois ambientes de deploy: responde texto fixo, sem chamar modelo e
sem gastar cota.

`AI_PROVIDER=nvidia` com `NVIDIA_API_KEY` vazia dá **502 no primeiro envio** — o
primeiro sinal disso é um usuário reclamando. A ordem é: subir com `echo`,
confirmar que está de pé, aí trocar para `nvidia`.

## Portas

Homolog e prod convivem na mesma VM, então `WEB_PORT` **não pode** ser o mesmo.

O compose de deploy publica **só** a interface. O Core (3001) fica em `expose`,
sem `ports` — ele confia no header cru `X-User-Id`, e publicá-lo transformaria
esse header em autorização.

Se a produção usar `WEB_PORT=80` e houver nginx do host como proxy reverso, é
melhor deixar `8080` e deixar a 80 com o host — senão o container disputa a porta.
