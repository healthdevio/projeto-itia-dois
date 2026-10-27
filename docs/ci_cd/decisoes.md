# Decisões do deploy

Registro das decisões tomadas para uma versão anterior da stack e do workflow. Os arquivos atuais já divergiram em nomes de serviço e imagem; não use este documento como especificação da configuração vigente sem reconciliar essas diferenças.

| Decisão                                                       | Motivo curto                                                     |
| ------------------------------------------------------------- | ---------------------------------------------------------------- |
| [API em vez de webhook](#api-em-vez-de-webhook)               | Stack webhook é Business Edition                                 |
| [O `PUT` reenvia o compose](#o-put-reenvia-o-compose)         | O PUT substitui; corpo incompleto apaga a stack                  |
| [O `Env` vai inteiro](#o-env-vai-inteiro)                     | A senha do Postgres vive no Env, não no compose                  |
| [Tags explícitas](#tags-explícitas-por-imagem)                | Gerador compartilhado faria cada build publicar nas duas imagens |
| [Três tags](#três-tags-por-imagem)                            | Branch para o deploy, sha para reverter                          |
| [Postgres preso ao compute01](#o-postgres-preso-ao-compute01) | Volume local; banco que muda de nó sobe vazio                    |
| [`replicas: 1` no Core](#replicas-1-no-core)                  | A migration roda no start; duas tasks rodariam juntas            |
| [Migration dentro do Core](#a-migration-dentro-do-core)       | No Swarm todo serviço é perpétuo                                 |
| [Sem healthcheck na stack](#sem-healthcheck-na-stack)         | Só o healthcheck da imagem conta                                 |
| [Senha como variável](#a-senha-vai-por-variável-de-ambiente)  | Uma fonte só, e o `.Env` já é reenviado no deploy                |
| [`platforms: linux/amd64`](#platforms-linuxamd64)             | O cluster é amd64                                                |
| [Cache do GHA](#o-cache)                                      | O `npm ci` é a etapa lenta                                       |

---

## API em vez de webhook

O Portainer é **Community Edition**. Webhook de stack é **Business Edition**: o
botão não aparece na tela, e `POST /api/stacks/webhooks/{id}` devolve `404`,
porque o endpoint não existe na CE.

A API existe nas duas edições. O custo é precisar de quatro secrets em vez de um:

```
PORTAINER_URL
PORTAINER_API_KEY
PORTAINER_STACK_ID
PORTAINER_ENDPOINT_ID
```

## O `PUT` reenvia o compose

O `PUT` de stack **substitui**. Não faz merge, não é patch.

| No corpo                   | O que o Swarm faz      |
| -------------------------- | ---------------------- |
| `StackFileContent` + `Env` | atualiza a stack       |
| Só `Env`                   | **remove os serviços** |

Sem o compose no corpo, o Swarm entende que a stack ficou vazia — e apaga. **Sem
erro.** O deploy passa como bem-sucedido.

Por isso o fluxo é `GET` → modifica → `PUT`:

```
GET /api/stacks/{id}/file     guarda o compose e o Env atuais
                              ↓ troca só as duas tags
PUT /api/stacks/{id}          reenvia os dois inteiros
```

E o workflow valida que o `StackFileContent` não veio vazio antes de enviar. Um
compose vazio nesse `PUT` apagaria a stack e passaria o pipeline verde.

## O `Env` vai inteiro

O `.Env` da stack guarda o que o compose **não** guarda:

| Variável            | Onde está    |
| ------------------- | ------------ |
| `POSTGRES_PASSWORD` | só no `.Env` |
| `NVIDIA_API_KEY`    | só no `.Env` |
| `OMNIA_WEB_PORT`    | só no `.Env` |
| `AI_PROVIDER`       | só no `.Env` |

O `docker-stack.yml` referencia `${POSTGRES_PASSWORD}` — mas o **valor** não está
no arquivo.

Se o `PUT` mandasse só as duas tags, o Postgres subiria **sem senha**. O sintoma
seria confuso: banco criado, Core conecta, migration roda, e nenhuma requisição
passa.

Por isso o `jq` só substitui duas entradas e preserva o resto.

## Tags explícitas por imagem

Cada `build-push-action` recebe **tags explícitas**, uma linha por imagem.

Se as duas imagens usassem um único gerador de tags, essa lista serviria para os
dois builds — e cada um publicaria nas duas. O último push sobrescreve o outro, e
`chat-core` passaria a conter a imagem da interface. O erro apareceria como
`node: not found` no boot do Core.

Como conferir: as duas tags de um mesmo build precisam ter **IDs de imagem
diferentes**.

## Três tags por imagem

```
chat-core:latest       ← inspeção
chat-core:<sha>       ← reversão
chat-core:<branch>    ← o que o deploy aplica
```

O deploy escreve a tag da branch em `OMNIA_CORE_IMAGE` e `OMNIA_WEB_IMAGE`, e o
`RepullImageAndRedeploy: true` faz o Swarm buscar essa tag no registry de novo.

A tag de sha é a via de reverter: aponta as duas variáveis para um deploy
anterior e atualiza a stack.

`latest` existe para inspeção, mas **não é o que o deploy aplica** — um ponteiro
que se move não permite voltar.

## O Postgres preso ao compute01

O volume `omnia_postgres_data` é **local**: não viaja entre servidores do Swarm.

Sem a constraint, o Swarm pode distribuir o container do Postgres para qualquer
nó. Quando isso acontece:

```
compute01   volume omnia_postgres_data  →  tem os dados
compute02   container novo do Postgres  →  banco VAZIO
```

O Core passa a conectar num banco sem as tabelas dele.

**O sintoma é enganoso.** A API devolve `relation "conversations" does not exist`
— igual a uma migration não aplicada. A diferença: a migration **roda e reporta
sucesso**. Ela cria o schema no banco errado.

Por isso a constraint:

```yaml
placement:
  constraints:
    - node.hostname == compute01
```

### Por que hostname e não label

|                    | hostname | label                            |
| ------------------ | -------- | -------------------------------- |
| Precisa de preparo | não      | `docker node update --label-add` |
| Falha visível      | nenhuma  | stack em `Pending` se faltar     |
| Passos extras      | —        | 1                                |

O nome do nó é um fato que já existe. O label é algo que alguém precisa
configurar, e esquecê-lo trava a stack inteira.

Conferir o nome real:

```bash
docker node ls
```

### Se o banco precisar mudar de nó

O volume é local: ele **não acompanha**. A troca exige remover e recriar o
serviço, e o banco antigo fica órfão no nó anterior.

```bash
docker service rm omnia_postgres
```

### O ponto único

Se o `compute01` cair, o banco vai com ele, e a stack sobe em outro nó **com o
banco vazio**. Sem driver compartilhado (NFS, Ceph), não há replica.

O Mongo do projeto da empresa usa o mesmo padrão local, então a operação é
compatível com a deles.

## `replicas: 1` no Core

A migration roda no start do Core, dentro do `entrypoint.sh`. Duas tasks subindo
juntas rodariam a migration **ao mesmo tempo** — que é a colisão que o schema
`drizzle_core` existe para evitar entre pacotes.

O Postgres também é `replicas: 1`, por outro motivo: um banco replicado em
nós diferentes apontaria para volumes diferentes.

## A migration dentro do Core

No compose, a migration era um serviço à parte:

```yaml
migrate-core:
  restart: 'no'
core:
  depends_on:
    migrate-core:
      condition: service_completed_successfully
```

**Nada disso funciona no Swarm.**

|                                  | Compose   | Swarm              |
| -------------------------------- | --------- | ------------------ |
| Container que termina            | permitido | serviço é perpétuo |
| `depends_on`                     | obedece   | **ignorado**       |
| `service_completed_successfully` | obedece   | não existe         |

Um serviço de migration sairia com o Swarm recriando em laço — e o Core esperaria
um `service_completed_successfully` que nunca aconteceria.

Por isso a migration virou parte do `entrypoint.sh`:

```
container sobe → espera o Postgres → node dist/db/migrate.js → node dist/index.js
```

Ver [`entrypoint.sh`](../../apps/docker/entrypoint.sh).

### O `exec` do final

```sh
exec node dist/index.js
```

O `exec` substitui o processo do shell pelo Node. Sem ele, o PID 1 do container
seria o shell, que não encaminha sinal — e o `docker service rm` levaria 10
segundos para parar em vez deStopped imediatamente.

### Por que esperar o Postgres no script

O Swarm não sabe esperar. Quem espera é a própria imagem, com `pg_isready` em
loop, 30 tentativas, 2 segundos cada.

Sem essa espera, o Core sobe antes do banco, tenta conectar, falha e o Swarm
reinicia a task — num laço cujo log é `ECONNREFUSED` repetido, difícil de
distinguir de "banco quebrado".

## Sem healthcheck na stack

O Core e o web têm `HEALTHCHECK` **na imagem** (`Dockerfile.core`,
`Dockerfile.web`), e é isso que o Swarm usa.

A seção `healthcheck:` do compose é redundante aqui: no `docker compose` ela
sobrescreve a da imagem; no Swarm, quem manda é a imagem. Manter os dois exigiria
duplicar a mesma verificação em dois lugares, e um esquecimento no compose
passaria despercebido.

O Postgres ficou sem nenhum dos dois — `pg_isready` é rápido e o Core já valida a
conexão na inicialização.

## A senha vai por variável de ambiente

A senha do Postgres está no `.Env` da stack, não em `docker secret`.

```yaml
POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:?defina POSTGRES_PASSWORD no .Env da stack}
```

O `:?` faz o Swarm **recusar a stack** com mensagem explícita se a variável não
existir, em vez de subir um banco com senha vazia.

Uma fonte só, sem `sed` para reescrever URL e sem arquivo para montar na mão.

O ponto de atenção: o `.Env` é legível por quem tem acesso ao Portainer, e o
`cd.yml` o lê e reenvia. Quem precisar de isolamento, volta para
`docker secret`.

## `platforms: linux/amd64`

O cluster é amd64. Declarar explicitamente evita que o build produza uma imagem
que não roda lá — erro que só apareceria no deploy, como
`no matching manifest for linux/amd64`.

`provenance: false` e `sbom: false` reduzem o que vai junto no registry. Se a
empresa quiser attestation e SBOM, é remover as duas linhas.

## O cache

```yaml
cache-from: type=gha
cache-to: type=gha,mode=max
```

`mode=max` guarda as layers intermediárias. O `npm ci` é a etapa lenta — sem
cache, cada build reinstala todas as dependências.

## Documentos relacionados

| Documento                              | Assunto                            |
| -------------------------------------- | ---------------------------------- |
| [deploy.md](deploy.md)                 | o processo de deploy passo a passo |
| [publicacao.md](publicacao.md)         | build e publicação                 |
| [pre-requisitos.md](pre-requisitos.md) | o que precisa existir antes        |
