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

## A stack do Swarm

O deploy vai para `apps/docker/pw2c/docker-stack.yml`, que é stack do Docker
Swarm — não compose.

| Serviço    | Função                               | Onde roda   |
| ---------- | ------------------------------------ | ----------- |
| `postgres` | o banco, com pgvector                | compute01   |
| `core`     | API, migrations e servidor HTTP      | qualquer nó |
| `web`      | nginx, serve a interface e faz proxy | qualquer nó |

O banco **é** da stack. Não existe mais a separação entre compose e Postgres
gerenciado por fora.

### `depends_on` não funciona no Swarm

Nem o `depends_on` nem o `service_completed_successfully` têm efeito no Swarm. E
todo serviço é perpétuo: não existe container que termina, então um serviço de
migration sairia com o Swarm recriando em laço.

Quem espera é o `entrypoint.sh` do Core:

```
espera o Postgres → node dist/db/migrate.js → node dist/index.js
```

Por isso `replicas: 1` no Core é obrigatório — duas tasks rodariam a migration ao
mesmo tempo.

### O Postgres fica preso ao compute01

O volume é local. Um banco que muda de nó sobe vazio, e a migration reporta
sucesso criando o schema no lugar errado.

```yaml
placement:
  constraints:
    - node.hostname == compute01
```

### Não tem serviço para o `knowledge`

As migrations do pacote `knowledge` criam `users`, `permissions`,
`api_integrations` e `chat_history` — tabelas que **nenhum serviço do Omnia lê**.
O Core tem o schema dele próprio (`conversations`, `messages`, `suggestions`) e é
só ele que a stack sobe.

O `knowledge` continua com migrations aplicadas pelo compose de desenvolvimento,
que é onde ele está em uso. Quando virar produto, o serviço volta.

## Ordem de subida

```
postgres ──> core (espera, migra, serve) ──> web
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
