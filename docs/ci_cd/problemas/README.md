# Problemas

Catálogo dos problemas que podem ocorrer na pipeline, e o que fazer quando um
deles aparecer de novo.

Este documento é o **diagnóstico**. O processo que evita cada um deles está em
[`../ci_cd/`](../README.md).

## Por sintoma

| O que aparece                               | Problema                        | Seção                                             |
| ------------------------------------------- | ------------------------------- | ------------------------------------------------- |
| `cd.yml` não aparece na aba Actions         | workflow fora da branch padrão  | [1](#1-o-cdyml-não-aparece)                       |
| `manifest unknown`                          | imagem não publicada            | [2](#2-manifest-unknown)                          |
| `unauthorized`                              | credencial do registry          | [3](#3-unauthorized)                              |
| `no matching manifest for linux/amd64`      | arquitetura errada              | [4](#4-no-matching-manifest-for-linuxamd64)       |
| `web` responde 502                          | o Backend não está no ar           | [5](#5-web-responde-502)                          |
| `constraint requirements not satisfied`     | nenhum nó chamado `compute01`   | [6](#6-constraint-requirements-not-satisfied)     |
| `relation "conversations" does not exist`   | banco vazio, em outro nó        | [7](#7-relation-conversations-does-not-exist)     |
| `core` reiniciando em loop                  | banco fora ou senha errada      | [8](#8-backend-reiniciando-em-loop)                  |
| `postgres nao respondeu apos 30 tentativas` | o Backend não acha o banco         | [9](#9-postgres-nao-respondeu-apos-30-tentativas) |
| migration falha sem motivo claro            | log incompleto                  | [10](#10-migration-falha-sem-causa)               |
| migration pula a primeira                   | carimbo de outro pacote         | [11](#11-migration-pula-a-primeira)               |
| workflow verde e a aplicação não mudou      | o `PUT` não redesenhou as tasks | [12](#12-workflow-verde-e-a-aplicação-não-mudou)  |
| serviços removidos depois do deploy         | `StackFileContent` vazio        | [13](#13-serviços-removidos-depois-do-deploy)     |

## Por causa

Quando o sintoma não estiver na tabela, o problema real costuma ser um destes.

---

## 1. O `cd.yml` não aparece

**Sintoma.** A aba Actions não lista `CD (Continuous Delivery)`.

**Causa.** `on: push` enxerga o workflow da branch de destino do push. Se o
arquivo não existir naquela branch, ele não aparece.

**Como confirmar.**

```bash
git ls-tree -r --name-only main -- .github/workflows
```

Tem que listar `ci.yml` e `cd.yml`.

**Como resolver.** Promover pelo fluxo normal de PR.

---

## 2. `manifest unknown`

**Sintoma.**

```
manifest unknown: manifest tagged by "89d7ca2" does not exist
```

**Causa.** O login no registry está bom — é isso que distingue do problema 3. A
imagem simplesmente não foi publicada.

**Como resolver.**

1. Abrir a aba **Actions** e ver se o job de build rodou
2. Se falhou, ler o log — quase sempre é autenticação ou quota

---

## 3. `unauthorized`

**Sintoma.**

```
unauthorized: incorrect username or password
```

**Causa.** Uma de duas:

| Situação                         | Como reconhecer                               |
| -------------------------------- | --------------------------------------------- |
| Credencial não criada no cluster | `docker service ls` mostra a task reiniciando |
| Token revogado ou expirado       | o login funcionou antes e parou               |

**Como resolver.**

```bash
printf 'usuario' | docker login registry.cloud.grupopw2c.com.br --password-stdin
```

**Prevenção.** O mesmo segredo é usado no GitHub e no cluster. Divergência entre
os dois é a causa mais comum — trocar no GitHub e esquecer o cluster.

---

## 4. `no matching manifest for linux/amd64`

**Sintoma.** A task do Swarm não sobe e o log cita a arquitetura.

**Causa.** A imagem foi construída para outra arquitetura. A Actions roda em
`ubuntu-latest`, que é amd64, mas o build precisa declarar isso explicitamente se
o cluster exigir:

```yaml
platforms: linux/amd64
```

**Como resolver.** Republicar com `platforms: linux/amd64` e atualizar a stack.

---

## 5. `web` responde 502

**Sintoma.** A interface abre, mas `/api/*` devolve 502.

**Causa.** O nginx responde e o Backend não. Quase sempre é o Backend subindo devagar: a
migration roda antes do servidor HTTP, e isso leva alguns segundos.

**Como diagnosticar.**

```bash
docker service ls --filter name=omnia_core    # deve mostrar 1/1
docker service logs omnia_core --tail 50
```

**Se o Backend estiver em `0/1`**, o problema é de subida — vá ao problema 8.

---

## 6. `constraint requirements not satisfied`

**Sintoma.** O Postgres fica em `Pending`, e o Backend em `0/1`.

**Causa.** A constraint exige um nó chamado `compute01`:

```yaml
placement:
  constraints:
    - node.hostname == compute01
```

Nenhum nó do cluster tem esse nome.

**Como confirmar.**

```bash
docker node ls
```

**Como resolver.** Ajustar a constraint para o nome real que aparecer na coluna
`HOSTNAME`, e atualizar a stack.

**Prevenção.** Conferir o nome do nó **antes** do primeiro deploy. É o
pré-requisito que mais trava.

---

## 7. `relation "conversations" does not exist`

**Sintoma.** O Backend conecta no banco e a API falha ao consultar.

**Causa.** O Postgres **não está no `compute01`**. O volume é local, e um banco
em outro nó sobe vazio — e a migration, longe de falhar, cria o schema no lugar
errado.

Este é o sintoma mais enganoso do catálogo: o log do Backend mostra a migration
como aplicada com sucesso, e o banco realmente recebeu as tabelas. Só que em um
outro banco.

**Como confirmar.**

```bash
docker service ps omnia_postgres --no-trunc
```

`CURRENT NODE` precisa ser `compute01`. E o log do Backend precisa mostrar a conexão
no banco certo:

```bash
docker service logs omnia_core --tail 50 | grep -i postgres
```

**Como resolver.**

```bash
docker service rm omnia_postgres
```

E subir de novo com a constraint corrigida. **Atenção**: o volume antigo fica
órfão no nó anterior, com os dados. Se havia algo a preservar:

```bash
docker volume ls | grep omnia_postgres
```

**Prevenção.** A constraint existe para isso. Ver
[deploy.md](../deploy.md).

---

## 8. `core` reiniciando em loop

**Sintoma.** O Backend sobe e cai. `0/1` ou `1/1` oscilando.

**Causa.** Uma de duas:

| Situação              | Como reconhecer                             |
| --------------------- | ------------------------------------------- |
| Banco fora do alcance | `postgres nao respondeu apos 30 tentativas` |
| Senha errada          | `password authentication failed`            |

**Como diagnosticar.**

```bash
docker service logs omnia_core --tail 50
```

**Como resolver.** Ver o problema 9 e o de senha abaixo.

### Senha errada

O Backend lê a senha do secret, mas o Postgres foi criado com a senha que estava em
`DATABASE_URL` no `docker-stack.yml`. Se as duas divergirem, o banco sobe e o
Backend não entra.

```bash
docker exec <id-postgres> env | grep POSTGRES
```

**Prevenção.** O valor em `DATABASE_URL` precisa ser a senha real. Ver
[pre-requisitos.md](../pre-requisitos.md).

---

## 9. `postgres nao respondeu apos 30 tentativas`

**Sintoma.** O `entrypoint.sh` desiste de esperar.

**Causa.** O Backend não resolve o nome `postgres`, ou o banco não está no ar.

**Como diagnosticar.**

```bash
docker service ls --filter name=omnia_postgres
docker service inspect omnia_core --format '{{json .Spec.TaskTemplate.Networks}}'
```

Os dois precisam listar `omnia_net`.

**Como resolver.** Se o Postgres estiver `1/1` e o Backend não acha o nome, os dois
serviços estão em redes diferentes — confira `docker stack ls` e recrie a stack.

---

## 10. Migration falha sem causa

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

**Prevenção.** Sem essa segunda linha, toda falha futura mostra só o SQL.

---

## 11. Migration pula a primeira

**Sintoma.** A primeira migration de um pacote nunca é aplicada.

**Causa.** Dois pacotes do Drizzle no **mesmo banco**, com a tabela de controle
compartilhada. O migrator decide o que já rodou comparando timestamps, e o Backend lê
o carimbo do `knowledge` — que é mais novo que a primeira migration do Backend.

**Como resolver.** Dar um schema próprio ao pacote:

```ts
await migrate(drizzle(pool, { schema }), {
  migrationsFolder: './drizzle',
  migrationsSchema: 'drizzle_core',
});
```

E o mesmo no `drizzle.config.ts`, para o `db:migrate` de desenvolvimento gravar no
mesmo lugar.

**Prevenção.** Sempre que um segundo pacote Drizzle entra no mesmo banco, os dois
precisam de schema de migrations distintos.

---

## 12. Workflow verde e a aplicação não mudou

**Sintoma.** O deploy rodou sem erro, mas a interface continua igual.

**Causa.** Uma de três:

| Situação                                | Como reconhecer                                      |
| --------------------------------------- | ---------------------------------------------------- |
| `OMNIA_CORE_IMAGE` não existe no `.Env` | o `jq` não encontrou, e avisou com `::warning::`     |
| O Swarm não recebeu a atualização       | o `PUT` respondeu 200 mas a task não foi redesenhada |
| A tag aplicada é a mesma                | o `.Env` aponta para `latest` e o build não rodou    |

**Como diagnosticar.**

```bash
docker service inspect omnia_core --format '{{.Spec.TaskTemplate.ContainerSpec.Image}}'
```

Se tiver `:latest` em vez de `:develop` ou `:main`, o problema é o `.Env`.

**Como resolver.** Adicionar `OMNIA_CORE_IMAGE` e `OMNIA_WEB_IMAGE` no `.Env` da
stack, com o nome exato que o `jq` procura.

---

## 13. Serviços removidos depois do deploy

**Sintoma.** A stack fica sem serviços depois de um `PUT`.

**Causa.** O `PUT` **substitui**. Se o corpo não tiver `StackFileContent`, o Swarm
entende que a stack ficou vazia e remove tudo.

**Como resolver.** O workflow já valida isso antes de enviar:

```bash
if [ ! -s stack.yml ]; then
  echo "::error::StackFileContent veio vazio" >&2
  exit 1
fi
```

Se aconteceu, o `GET` anterior falhou silenciosamente. Subir a stack de novo pelo
Portainer com o `docker-stack.yml`.

**Prevenção.** Nunca enviar `PUT` com o compose montado à mão. O fluxo
`GET` → modifica → `PUT` existe por isso.

---

## Problemas que não são da pipeline

| Sintoma                        | Onde é                                                       |
| ------------------------------ | ------------------------------------------------------------ |
| `curl: (3) URL rejected`       | aspas no PowerShell: o corpo tem que ir num arquivo, com `@` |
| `toomanyrequests` no pull      | limite anônimo do Docker Hub                                 |
| `Not secure` no navegador      | HTTP sem TLS                                                 |
| task em `Pending` sem mensagem | falta o nó da constraint — problema 6                        |

## Documentos relacionados

| Documento                                 | Assunto                       |
| ----------------------------------------- | ----------------------------- |
| [operacao.md](../operacao.md)             | verificação diária e comandos |
| [pre-requisitos.md](../pre-requisitos.md) | o que precisa existir antes   |
| [deploy.md](../deploy.md)                 | o processo de deploy          |
