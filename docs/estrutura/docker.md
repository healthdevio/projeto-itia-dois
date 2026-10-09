# Docker

Três imagens e um compose de deploy. Tudo em `apps/docker/`.

## As imagens

| Dockerfile             | Imagem    | Serve                                                   |
| ---------------------- | --------- | ------------------------------------------------------- |
| `Dockerfile.core`      | Core      | API (Hono) + migrations                                 |
| `Dockerfile.web`       | Interface | bundle do Vite servido pelo nginx                       |
| `Dockerfile.knowledge` | Knowledge | migrations do pacote `knowledge`                        |
| `Dockerfile`           | —         | o compose **de desenvolvimento**; não é usado no deploy |

### Dockerfile.core

Três etapas: `build` compila o TypeScript e leva o `devDependencies` inteiro;
`deps` instala só as dependências de produção; `runtime` junta as duas.

Roda como usuário `node` (não-root) e tem healthcheck em `/`.

O healthcheck confere o **código HTTP**, não o corpo. `/` responde `200` com
`"degraded"` quando o Postgres está fora do ar — derrubar o Core por causa do
banco trocaria uma degradação visível por indisponibilidade total.

A pasta `drizzle/` vai para a imagem porque o deploy aplica as migrations num
container separado, antes do Core subir.

### Dockerfile.web

Duas etapas: build do Vite, depois nginx com os arquivos estáticos.

`VITE_CORE_URL` é **argumento de build**, não variável de ambiente de runtime: o
Vite embute o valor no bundle durante a compilação. Passar via `docker run -e`
não teria efeito.

### Dockerfile.knowledge

Única imagem que ainda roda `drizzle-kit`. O pacote `knowledge` não tem um
migrator próprio; o Core tem (`src/db/migrate.ts`). Quando o `knowledge` ganhar
um, esta imagem sai e o serviço passa a usar a do Core.

## nginx.conf

Serve o bundle e faz proxy de `/api` para `core:3001`. Isso coloca interface e
API na mesma origem: sem CORS, e sem URL do Core virando config do frontend.

Três decisões:

**Timeout de 330s.** O provider Nvidia tem teto de 5 min
(`NVIDIA_TIMEOUT_MS`). O proxy precisa ficar no mesmo patamar, senão vira o
gargalo e corta a resposta no meio da digitação.

**`proxy_buffering off`.** Sem isso o nginx segura a resposta até completar o
buffer, e o streaming token a token não acontece.

**`index.html` com `no-cache`.** É ele que aponta para os assets com hash.
Cacheado, a interface continua servindo a versão anterior depois de um deploy.

### O Core não deve ser exposto

Ele confia no header cru `X-User-Id`: qualquer cliente pode enviar o que quiser e
impersonar outro usuário. Por isso o compose publica **só** a porta da interface.
Num ambiente com usuários reais, um proxy na frente do Core precisa validar um
token (JWT, sessão, mTLS) e reescrever o header com o subject autenticado.

## docker-compose.deploy.yml

Um compose para os dois ambientes. O que muda entre homologação e produção é o
`.env` (imagem, porta, secrets), não o arquivo — dois composes por ambiente
divergiriam sem ninguém perceber.

| Serviço        | Função                       | Porta         |
| -------------- | ---------------------------- | ------------- |
| `db`           | espera o Postgres (só check) | —             |
| `migrate-core` | migrations do Core           | —             |
| `core`         | API                          | interna       |
| `web`          | nginx                        | `${WEB_PORT}` |

### Não tem serviço `postgres`

O banco já existe na VM (container `omnia-postgres`, volume
`ubuntu_omnia_postgres_data`) e é gerenciado pelo Portainer. Este compose **não o
cria** — só o alcança, pela rede externa `omnia-db`.

Subir um Postgres aqui criaria um banco novo e vazio, com volume separado, e o
Core passaria a falar com ele em vez do banco real.

`deploy.sh` cria a rede se faltar. Ver
[pre-requisitos.md](../ci_cd/pre-requisitos.md) para conectar o `omnia-postgres` a
ela — **já feito** na VM.

O serviço `db` existe só para o Core não subir antes do banco responder: espera o
`pg_isready` passar e sai. Não gerencia o container alheio.

### Não tem serviço `migrate-knowledge`

As migrations do pacote `knowledge` criam `users`, `permissions`,
`api_integrations` e `chat_history` — tabelas que **nenhum serviço do Omnia lê**.
O Core tem o schema dele próprio (`conversations`, `messages`, `suggestions`) e é
só ele que o compose deploya.

O `knowledge` continua com migrations aplicadas pelo compose de desenvolvimento,
que é onde ele está em uso. Quando virar produto, o serviço volta e
`IMAGE_KNOWLEDGE` volta ao `.env`.

### `service_completed_successfully`

```yaml
core:
  depends_on:
    migrate-core:
      condition: service_completed_successfully
```

`migrate-core` tem `restart: 'no'` e termina. Sem esta condição, o Core sobe
junto com as migrations e quebra no primeiro acesso ao banco.

O mesmo vale para o `db`, que também **sai** depois de pronto. Um container que
termina nunca fica `healthy`, então `service_healthy` nele seria uma espera que
nunca satisfaz — o deploy travaria antes de começar.

### Ordem de subida

```
db (espera o postgres) ──> migrate-core (sai) ──> core (healthy) ──> web
```

## O `.dockerignore`

Os Dockerfiles copiam caminhos da **raiz** do repositório
(`COPY apps/chat-core/...`), então o contexto de build é a raiz inteira. Sem o
`.dockerignore`, cada build enviaria `node_modules` e `dist` de todos os apps,
mais o `.git` — que passa de 100 MB e, por mudar a cada commit, invalidaria a
camada do `npm ci`.

## Verificar sem subir nada

```bash
cd apps/docker
docker compose config
```

Mostra a configuração final com as variáveis já interpoladas. É o jeito de
descobrir senha vazia ou variável com nome errado **antes** de `up`.
