# Operação

Verificar se o deploy funcionou, diagnosticar quando não funcionou, e reverter.

## Verificar

No cluster:

```bash
docker service ls --filter name=omnia_
```

Esperado:

```
ID       NAME            MODE         REPLICAS   IMAGE
xxxx     omnia_web       replicated   1/1        .../chat-web:develop
xxxx     omnia_core      replicated   1/1        .../chat-core:develop
xxxx     omnia_postgres  replicated   1/1        pgvector/pgvector:pg16
```

**`1/1` em todos.** Um `0/1` ou `Pending` é o primeiro sinal de que a stack não
subiu.

### Conferir que as tabelas existem

O Postgres roda no `compute01`. O container tem nome gerado pelo Swarm, então
descubra pelo filtro:

```bash
docker ps --filter name=omnia_postgres -q
```

Com o id em mãos:

```bash
docker exec <id> psql -U omnia_user -d omnia -c "\dt"
```

Devem aparecer `conversations`, `messages` e `suggestions`.

### Conferir a aplicação

No navegador, na porta da stack:

```
http://<host>:8080
```

### Conferir a API pelo proxy

Prova a cadeia inteira: navegador → nginx → Core → Postgres.

```powershell
curl.exe -H "X-User-Id: ana" http://<host>:8080/api/conversations/current
```

```json
{"success":true,"data":{"id":"...","state":"idle","messages":[],...}}
```

Para enviar uma mensagem, o corpo vai num arquivo — aspas em linha de comando do
PowerShell não sobrevivem:

```powershell
curl.exe -H "X-User-Id: ana" -H "Content-Type: application/json" `
  --data-binary "@C:\Users\Alec\mensagem.json" `
  http://<host>:8080/api/messages
```

Com `AI_PROVIDER=echo`, a resposta vem com `[echo] Recebi: ...`, sem gastar cota.

## Diagnóstico por sintoma

| Sintoma                                   | Causa provável                          |
| ----------------------------------------- | --------------------------------------- |
| `cd.yml` não aparece na aba Actions       | não chegou na branch padrão             |
| `manifest unknown`                        | login ok; a imagem não foi publicada    |
| `unauthorized` no `pull`                  | credencial do registry                  |
| `no matching manifest for linux/amd64`    | a imagem foi construída para outra arch |
| `web` responde 502                        | o Core não está no ar                   |
| `core` reiniciando em loop                | banco fora, ou senha errada             |
| `relation "conversations" does not exist` | o Core conectou num banco vazio         |
| `constraint requirements not satisfied`   | nenhum nó chamado `compute01`           |
| workflow verde e a aplicação não mudou    | `RepullImageAndRedeploy` não chegou     |

### Onde ver o log de cada serviço

```bash
docker service logs omnia_core -f
docker service logs omnia_postgres -f
```

O log do Core começa pelo `entrypoint.sh`, que é onde a causa costuma estar:

```
[entrypoint] esperando o postgres
[entrypoint] postgres nao respondeu apos 30 tentativas
```

Essa linha é a resposta mais direta que existe: o banco não subiu, ou o Core
não resolveu o nome.

### Quando o Postgres não resolve

Sintoma: `getaddrinfo ENOTFOUND postgres`, ou o Core sai com
`postgres nao respondeu apos 30 tentativas`.

No Swarm, o nome vem da rede overlay. Conferir se o Core está na mesma rede:

```bash
docker service inspect omnia_core --format '{{json .Spec.TaskTemplate.Networks}}'
```

Tem que listar `omnia_net`, e o mesmo para o Postgres.

### Quando o banco sobe vazio

Sintoma: `relation "conversations" does not exist`, mas o log do Core mostra a
migration como aplicada.

Isso é o Postgres **não está no `compute01`**. O volume é local, e um banco em
outro nó sobe vazio — e a migration, longe de falhar, cria o schema no lugar
errado.

```bash
docker service ps omnia_postgres --no-trunc
```

O nome do nó em `CURRENT NODE` precisa ser `compute01`.

## Reverter

Não há botão de rollback. Em **Stacks → omnia → Environment variables**, troque:

```
OMNIA_CORE_IMAGE = registry.../chat-core:<sha-antigo>
OMNIA_WEB_IMAGE  = registry.../chat-web:<sha-antigo>
```

Depois **Update the stack** com _Re-pull image_.

Vale para o **código**. Migration já aplicada não é revertida ao trocar a tag — o
Drizzle não tem `down`. Se a versão antiga não roda com o schema novo, o rollback
é restaurar o volume do Postgres, não só a imagem.

Por isso a tag de commit é publicada: é o que torna o rollback possível.

## Limpeza de disco

Cada build deixa layers no nó onde rodou.

```bash
docker system df
docker image prune          # só dangling, risco zero
docker builder prune        # cache de build
```

**Nunca** remover `pgvector/pgvector:pg16`, `portainer/portainer-ce:lts` e as
imagens em uso: são as dos containers rodando.

## Manutenção

| Ação                            | Frequência                   |
| ------------------------------- | ---------------------------- |
| `docker system df` para ver uso | quando o disco apertar       |
| Prune de imagens dangling       | mensal                       |
| Backup do volume do Postgres    | conforme a política de dados |
| Conferir o token do registry    | a cada 90 dias               |
| Conferir `docker node ls`       | quando o cluster mudar       |

### O volume do Postgres é um ponto único

O `omnia_postgres_data` é local ao `compute01`. Se aquele nó cair, o banco vai
com ele, e a stack sobe em outro nó **com o banco vazio**.

Antes de qualquer manutenção no nó, verifique se existe backup. Um
`docker volume ls` mostra o volume; o conteúdo só existe naquele servidor.

## Documentos relacionados

| Documento                              | Assunto                     |
| -------------------------------------- | --------------------------- |
| [deploy.md](deploy.md)                 | o que acontece no cluster   |
| [publicacao.md](publicacao.md)         | build e publicação          |
| [pre-requisitos.md](pre-requisitos.md) | o que precisa existir antes |
