# Problemas

Catálogo dos problemas que já ocorreram na pipeline, e o que fazer quando um deles
aparecer de novo.

Este documento é o **diagnóstico**. O processo que evita cada um deles está em
[`../ci_cd/`](../README.md).

## Por sintoma

O caminho mais rápido: achei a mensagem no log e pule para a seção.

| O que aparece                       | Problema                       | Seção                                        |
| ----------------------------------- | ------------------------------ | -------------------------------------------- |
| `cd.yml` não aparece na aba Actions | workflow fora da branch padrão | [1](#1-o-cdyml-não-aparece)                  |
| `manifest unknown`                  | imagem não publicada           | [2](#2-manifest-unknown)                     |
| `unauthorized`                      | credencial do registry         | [3](#3-unauthorized)                         |
| `node: not found`                   | imagem trocada no registry     | [4](#4-node-not-found)                       |
| `tar: empty archive`                | scp não achou os arquivos      | [5](#5-tar-empty-archive)                    |
| `IMAGE_CORE missing`                | variável não chegou ao script  | [6](#6-required-variable-image_core-missing) |
| `getaddrinfo ENOTFOUND postgres`    | banco fora da rede             | [7](#7-getaddrinfo-enotfound-postgres)       |
| healthcheck travado em `Waiting`    | DNS ou alias                   | [8](#8-healthcheck-travado-em-waiting)       |
| migration falha sem motivo claro    | log incompleto                 | [9](#9-migration-falha-sem-causa)            |
| migration pula a primeira           | carimbo de outro pacote        | [10](#10-migration-pula-a-primeira)          |
| `database: "down"`                  | senha do banco                 | [11](#11-database-down)                      |
| `core` reiniciando em loop          | `DATABASE_URL` ou migration    | [12](#12-core-reiniciando-em-loop)           |

## Por causa

Quando o sintoma não estiver na tabela, o problema real costuma ser um destes.

---

## 1. O `cd.yml` não aparece na aba Actions

**Sintoma.** A aba Actions não lista `CD (Continuous Delivery)`, ou o botão
`Run workflow` não existe.

**Causa.** `workflow_run` e `workflow_dispatch` só enxergam workflows presentes na
**branch padrão** do repositório, que é a `main`. Se o `cd.yml` estiver apenas na
`develop`, o workflow fica inerte — e a falha é **silenciosa**: sem erro, sem
aviso, nada acontece.

**Como confirmar.**

```bash
git ls-tree -r --name-only main -- .github/workflows
```

Tem que listar `ci.yml` e `cd.yml`.

**Como resolver.** Promover o `cd.yml` para a `main`, pelo fluxo normal de PR.

**Prevenção.** Promover para a `main` junto com a primeira correção do `cd.yml`.

---

## 2. `manifest unknown`

**Sintoma.**

```
manifest unknown: manifest tagged by "89d7ca2" does not exist
```

**Causa.** O login no registry está bom — é isso que distingue do problema 3.
A imagem simplesmente não foi publicada, porque o build não rodou ou falhou.

**Como resolver.**

1. Abrir a aba **Actions**, achar o run do CD e ver o job `build`
2. Se o job não existe, o CD nem disparou — voltar ao problema 1
3. Se o job falhou, ler o log: quase sempre é autenticação ou quota

**Prevenção.** Conferir o passo **O que foi publicado** ao final do job `build`.

---

## 3. `unauthorized`

**Sintoma.**

```
unauthorized: incorrect username or password
```

**Causa.** Uma de três:

| Situação                      | Como reconhecer                                                   |
| ----------------------------- | ----------------------------------------------------------------- |
| Nunca fez login na VM         | `cat ~/.docker/config.json` não tem `ghcr.io`                     |
| Fez login com `sudo`          | o arquivo está em `/root/.docker/`, e o deploy roda como `ubuntu` |
| Token expirou ou foi revogado | o login funcionou antes e parou                                   |

**Como resolver.**

```bash
nano /tmp/tok
# cola um token novo com escopo read:packages, Ctrl+O, Enter, Ctrl+X

docker login ghcr.io -u USUARIO --password-stdin < /tmp/tok
rm /tmp/tok
```

**Prevenção.** Nunca usar `sudo` no login. O `ubuntu` já está no grupo `docker`, e
o `deploy.sh` chama `docker` sem privilégio.

Token de PAT expira em 90 dias por padrão. Renovar antes.

---

## 4. `node: not found`

**Sintoma.** Um serviço que deveria rodar Node falha com:

```
/docker-entrypoint.sh: exec: line 47: node: not found
```

**Causa.** A imagem baixada **não é a que se esperava**. Duas possibilidades:

| Mensagem                    | Causa                                              |
| --------------------------- | -------------------------------------------------- |
| `node: not found`           | a imagem é de outra aplicação (nginx não tem Node) |
| `executable file not found` | o comando está errado no compose                   |

**Como confirmar.** Na VM:

```bash
docker run --rm --entrypoint sh ghcr.io/healthdevio/chat-core:<tag> \
  -c "which node; ls dist/"
```

Sem `node` e sem `dist`, a imagem está trocada.

**Como resolver.** Republicar a imagem correta e rodar o deploy de novo.

**Prevenção.** Cada `build-push-action` precisa receber **tags explícitas**, uma
linha por imagem. Se um gerador único de tags estiver configurado para as duas
imagens, cada build publica nas duas — e o último sobrescreve o outro, deixando
`chat-core` com o conteúdo da interface.

Conferir no registry: as duas tags de um mesmo build precisam ter **IDs de imagem
diferentes**.

---

## 5. `tar: empty archive`

**Sintoma.**

```
tar: empty archive
exit status 1
```

**Causa.** O `scp-action` monta um tar com os caminhos de `source` e nenhum
resolveu para arquivo.

Duas causas possíveis:

| `source`                        | Problema                                   |
| ------------------------------- | ------------------------------------------ |
| Bloco `\|` com quebras de linha | o item final vazio quebra o glob           |
| Caminho escrito errado          | o arquivo não está onde a configuração diz |

**Como resolver.**

```yaml
source: apps/docker/docker-compose.deploy.yml,apps/docker/deploy.sh
```

Uma linha, separada por vírgula, sem espaço.

**Prevenção.** Manter um passo de verificação antes do scp:

```yaml
- name: Conferir os arquivos que serão enviados
  run: ls -la apps/docker/docker-compose.deploy.yml apps/docker/deploy.sh
```

Com ele, o erro deixa de ser opaco.

### Os arquivos chegam no lugar errado

**Sintoma.** O scp passa, mas o `deploy.sh` executado é uma versão antiga.

**Causa.** O scp preserva a árvore do tar no destino:

```
source: apps/docker/deploy.sh
        ↓
/srv/omnia/homolog/apps/docker/deploy.sh    ← caiu aqui
/srv/omnia/homolog/deploy.sh                 ← a cópia antiga, que é executada
```

**Como resolver.**

```yaml
strip_components: 2
```

Remove os dois primeiros níveis e deixa o arquivo na raiz.

---

## 6. `required variable IMAGE_CORE missing`

**Sintoma.**

```
./deploy.sh: line 61: IMAGE_CORE: informe IMAGE_CORE
```

**Causa.** O `deploy.sh` exige `IMAGE_CORE` e `IMAGE_WEB` por variável de
ambiente, e o workflow não está repassando.

No `appleboy/ssh-action` são **duas peças**, em lugares diferentes:

```yaml
env: # define no runner
  IMAGE_CORE: ${{ needs.build.outputs.image-core }}
  IMAGE_WEB: ${{ needs.build.outputs.image-web }}
with:
  envs: 'IMAGE_CORE,IMAGE_WEB' # input: o que atravessa o SSH
```

`envs:` dentro de `with:`, porque é um input da action. `environment:` **não
existe** naquele schema — a action ignora, e as variáveis chegam vazias.

**Prevenção.** Ler as duas peças na mesma tela, e lembrar que `steps.*.outputs`
não atravessa jobs: quem produz precisa declarar em `outputs:` no nível do job.

---

## 7. `getaddrinfo ENOTFOUND postgres`

**Sintoma.** O Core não sobe, e o erro cita `postgres`.

**Causa.** O Core resolve o host pelo nome do serviço no compose, `postgres`. Essa
resolução só existe na rede externa `omnia-db`.

**Como resolver.**

```bash
sudo docker network connect --alias postgres omnia-db omnia-postgres
docker network inspect omnia-db --format '{{range .Containers}}{{.Name}} {{end}}'
```

Precisa listar `omnia-postgres`.

**Prevenção.** O banco é gerenciado por fora do compose, então essa conexão é
manual e precisa ser refeita quando o Portainer recria o container. Ver
[pre-requisitos](../pre-requisitos.md).

---

## 8. Healthcheck travado em `Waiting`

**Sintoma.** O serviço `db` fica em `Waiting` e o deploy não termina. O
`migrate-core` nunca começa.

**Causa.** Quase sempre DNS. O healthcheck roda `pg_isready` em loop até o banco
responder, e sem resolução de nome ele repete para sempre — nunca sai, nunca
falha.

**Como diagnosticar.**

```bash
docker logs omnia-db-1
docker exec omnia-db-1 getent hosts postgres
```

`no response` repetindo, ou saída vazia do `getent`, é DNS.

**Como resolver.** Reconectar o banco com o alias (problema 7) e derrubar o
container velho:

```bash
docker rm -f omnia-db-1
```

O `up` do próximo deploy recria limpo.

**Prevenção.** Vale notar que `Waiting` é um estado de espera, não de falha: o
workflow fica pendurado sem timeout. Ao ver `Waiting`, o passo seguinte é olhar o
`docker logs` do serviço, não esperar.

---

## 9. Migration falha sem causa clara

**Sintoma.**

```
[Core] Falha ao aplicar migrations: Failed query:
ALTER TABLE "suggestions" ADD CONSTRAINT ...
```

Só o SQL, nenhuma explicação.

**Causa.** O Drizzle embrulha o erro do Postgres: `message` traz a query que
falhou, e o motivo real vem em `cause`.

**Como resolver.** O log de falha precisa mostrar as duas partes:

```ts
console.error('[Core] Falha ao aplicar migrations:', error.message);

if (error instanceof Error && error.cause) {
  console.error('[Core] Causa:', error.cause.message);
}
```

**Prevenção.** Sem essa segunda linha, toda falha futura de migration mostra só
o SQL — e o diagnóstico depende de adivinhar.

---

## 10. Migration pula a primeira

**Sintoma.** A primeira migration de um pacote nunca é aplicada; a seguinte falha
porque falta a tabela que ela criaria.

**Causa.** Dois pacotes do Drizzle no **mesmo banco**, com a tabela de controle
compartilhada:

```
drizzle.__drizzle_migrations
```

O migrator decide o que já rodou comparando o timestamp de cada migration com o
último carimbo registrado. Se o carimbo vem de outro pacote:

```
knowledge  0000 a 0006   2026-09-25 a 2026-09-30
chat-core  0000          2026-09-28   ← mais antiga que o carimbo, então pula
           0001 a 0003   2026-10-01 a 2026-10-06
```

O Core lê `2026-09-30`, conclui que a própria `0000` já foi aplicada, e pula.

**Como confirmar.**

```bash
docker exec omnia-postgres psql -U omnia_user -d omnia \
  -c "select created_at from drizzle.__drizzle_migrations order by created_at;"
```

E comparar com os timestamps dos journals:

```bash
node -e "console.log(require('./drizzle/meta/_journal.json').entries)"
```

**Como resolver.** Dar um schema próprio para as migrations do pacote:

```ts
await migrate(drizzle(pool, { schema }), {
  migrationsFolder: './drizzle',
  migrationsSchema: 'drizzle_core',
});
```

E o mesmo no `drizzle.config.ts` do pacote, para o `db:migrate` de
desenvolvimento gravar no mesmo lugar:

```ts
migrations: {
  schema: 'drizzle_core',
  table: '__drizzle_migrations',
},
```

**Prevenção.** Sempre que um segundo pacote Drizzle entra no mesmo banco, os dois
precisam de schema de migrations distintos. E vale lembrar: dois `migrate()` com
schemas diferentes podem **rodar em paralelo** com o mesmo nome de tabela,
porque `search_path` é resolvido por pool. Se os dois subirem juntos, definir o
schema por **variável de ambiente** e passar na URL, não apenas no parâmetro.

---

## 11. `database: "down"`

**Sintoma.** O health check responde:

```json
{ "status": "degraded", "database": "down" }
```

E a interface **continua respondendo 200**, porque o nginx serve o bundle antes do
Core estar pronto.

**Causa.** `POSTGRES_PASSWORD` do `.env` não é a senha que o banco aceita.

**Como resolver.**

```bash
docker exec omnia-postgres printenv | grep POSTGRES_PASSWORD
```

Conferir contra o `.env` do ambiente.

Para conferir se o Core alcança o banco, com a senha do `.env`:

```bash
docker exec omnia-core-1 sh -c \
  'PGPASSWORD="$POSTGRES_PASSWORD" psql -h postgres -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "select 1;"'
```

**Prevenção.** O `.env` nunca é regenerado pelo deploy — só as linhas `IMAGE_*` são
reescritas. A senha que estiver lá é a que o banco precisa.

---

## 12. `core` reiniciando em loop

**Sintoma.** O container do Core sobe e cai, repetidamente, e o `web` responde 502.

**Causa.** Uma de duas:

| Situação               | Como reconhecer                            |
| ---------------------- | ------------------------------------------ |
| `DATABASE_URL` errada  | o health check responde `database: "down"` |
| Migration não aplicada | a tabela não existe no banco               |

**Como resolver.**

```bash
docker logs omnia-core-1 --tail 50
docker exec omnia-postgres psql -U omnia_user -d omnia -c "\dt"
```

Faltando as tabelas do Core, o problema 10 se aplica.

**Prevenção.** A ordem de subida já garante que o Core só sobe depois das
migrations, por `service_completed_successfully`. Se as tabelas não existem mesmo
assim, a migration rodou em outro schema.

---

## Problemas que não são do pipeline

| Sintoma                                                        | Onde é                                                       |
| -------------------------------------------------------------- | ------------------------------------------------------------ |
| `curl: (3) URL rejected: Port number was not a decimal number` | aspas no PowerShell: o corpo tem que ir num arquivo, com `@` |
| `JSON inválido no corpo da requisição`                         | consequência do anterior; o `400` está correto               |
| `toomanyrequests` no pull                                      | limite anônimo do Docker Hub: `docker login` no Docker Hub   |
| `Not secure` no navegador                                      | HTTP sem TLS; esperado em homologação                        |
| `relation "conversations" does not exist`                      | o schema das migrations está em outro lugar — problema 10    |

## Documentos relacionados

| Documento                                 | Assunto                       |
| ----------------------------------------- | ----------------------------- |
| [operacao.md](../operacao.md)             | verificação diária e comandos |
| [pre-requisitos.md](../pre-requisitos.md) | o que precisa existir antes   |
| [deploy.md](../deploy.md)                 | o processo de deploy          |
