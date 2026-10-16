# Ambientes

Dois ambientes: desenvolvimento na máquina, e a stack no cluster da PW2C.

| Ambiente        | Onde          | Configuração                       | Vai pro git? |
| --------------- | ------------- | ---------------------------------- | ------------ |
| Desenvolvimento | máquina local | `apps/docker/.env`                 | **não**      |
| Cluster da PW2C | Portainer     | **Environment variables** da stack | **não**      |

O segundo não tem arquivo. As variáveis vivem no Portainer, em **Stacks → omnia
→ Environment variables**, e é de lá que o `cd.yml` lê.

## O que versiona e o que não

```
apps/docker/.env.dev                → git   (template)
apps/docker/pw2c/stack.env.example → git   (template)
apps/docker/.env                    → NUNCA git
```

Nenhum `.env` real é versionado. O `.gitignore` da raiz tem `.env` na linha 1, e
cobre qualquer subpasta:

```console
$ git check-ignore -v apps/docker/.env
.gitignore:1:.env	apps/docker/.env
```

Os dois templates têm a senha **vazia**. O que a senha real ocupa é o
`Environment variables` do Portainer.

## O `.env` de desenvolvimento

`apps/docker/.env` tem **uma linha**:

```bash
POSTGRES_PASSWORD=<a senha do banco local>
```

O template está em `apps/docker/.env.dev`:

```bash
cp apps/docker/.env.dev apps/docker/.env
```

### O nome da variável

O compose lê `${POSTGRES_PASSWORD}` como **nome de variável**, não como valor.
Sem o `.env`, a variável não existe e o Postgres sobe com senha vazia:

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

O mesmo `:?` está no `docker-stack.yml`, e tem o mesmo efeito: **sem
`POSTGRES_PASSWORD` no `.Env`, o Swarm recusa a stack**.

### A porta 5433

O compose de dev publica `5433:5432`, para não colidir com um Postgres que já
exista na máquina. O `.env.example` do `chat-core` aponta para `localhost:5432`,
então para usar o banco local:

```bash
DATABASE_URL=postgresql://omnia_user:<senha>@localhost:5433/omnia
```

## O banco da stack

Na stack, o Postgres é **serviço dela**, com volume `omnia_postgres_data` preso
ao `compute01`.

Não existe mais a separação do modelo antigo, em que o banco vivia num container
à parte, conectado por `--alias` numa rede externa. O Swarm resolve `postgres`
pelo DNS da rede overlay.

### A senha

A senha do cluster é a que está no `POSTGRES_PASSWORD` do `Environment variables`.
Tem que ser a senha que o Postgres aceita:

```bash
docker exec <id-do-container> env | grep POSTGRES
```

Se divergirem, o banco sobe, o Core tenta entrar e falha com
`password authentication failed`.

Para trocar depois, é preciso alterar no banco **e** na variável:

```bash
docker exec <id-do-container> psql -U omnia_user -d omnia \
  -c "ALTER USER omnia_user WITH PASSWORD '<nova>';"
```

Só trocar a variável não funciona: o Postgres guarda a senha em disco.

### Dev e cluster são bancos diferentes

O dev sobe o Postgres pelo `docker-compose.yml`, com volume próprio. São bancos
separados, com senhas separadas. O banco local não é o do cluster.

## A rede

|                 |                                           |
| --------------- | ----------------------------------------- |
| Desenvolvimento | a rede padrão do compose, `omnia_default` |
| Cluster         | `omnia_net`, overlay do Swarm             |

Não existe mais a rede externa `omnia-db`, nem o `docker network connect` à mão.
O Swarm gerencia a rede overlay e registra cada serviço nela.

## AI_PROVIDER

`echo` na stack: responde texto fixo, sem chamar modelo e sem gastar cota.

`AI_PROVIDER=nvidia` com `NVIDIA_API_KEY` vazia dá **502 no primeiro envio** — o
primeiro sinal disso é um usuário reclamando. A ordem é: subir com `echo`,
confirmar que está de pé, aí trocar para `nvidia`.

## Portas

O stack publica **só** a interface. O Core (3001) fica em `expose`, sem `ports` —
ele confia no header cru `X-User-Id`, e publicá-lo transformaria esse header em
autorização.

```yaml
ports:
  - target: 80
    published: ${OMNIA_WEB_PORT:-8080}
    mode: host
```

Em `mode: host` o Swarm publica no nó que roda a task. Com o Postgres fixo no
`compute01` e o Core em qualquer nó, **`OMNIA_WEB_PORT` precisa ser o mesmo em
todos** — senão o acesso depende de qual servidor recebeu a task.

## Documentos relacionados

| Documento                                                | Assunto                     |
| -------------------------------------------------------- | --------------------------- |
| [../ci_cd/pre-requisitos.md](../ci_cd/pre-requisitos.md) | o que configurar no cluster |
| [../ci_cd/deploy.md](../ci_cd/deploy.md)                 | o processo de deploy        |
