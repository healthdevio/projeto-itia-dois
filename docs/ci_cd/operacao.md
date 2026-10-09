# Operação

Verificar se o deploy funcionou, diagnosticar quando não funcionou, e reverter.

## Verificar

Na VM:

```bash
cd /srv/omnia/homolog
docker compose --env-file .env -f docker-compose.deploy.yml ps
```

Esperado:

```
omnia-db-1             Exited (0)     ← healthcheck terminou bem
omnia-migrate-core-1   Exited (0)     ← migrations aplicadas
omnia-core-1           Up (healthy)
omnia-web-1            Up (healthy)
```

O `-f docker-compose.deploy.yml` é obrigatório: o compose procura
`docker-compose.yml`, que não existe nessa pasta.

### Conferir que as tabelas existem

```bash
docker exec omnia-postgres psql -U omnia_user -d omnia -c "\dt"
```

Devem aparecer `conversations`, `messages` e `suggestions`.

### Conferir a aplicação

No navegador:

```
http://167.126.20.64:8080
```

### Conferir a API pelo proxy

No PowerShell do Windows:

```powershell
curl.exe -H "X-User-Id: ana" http://167.126.20.64:8080/api/conversations/current
```

```json
{"success":true,"data":{"id":"...","state":"idle","messages":[],...}}
```

Isso prova a cadeia inteira: navegador → nginx → Core → Postgres, com escrita no
banco.

Para enviar uma mensagem, o corpo vai num arquivo — aspas em linha de comando do
PowerShell não sobrevivem:

```powershell
curl.exe -H "X-User-Id: ana" -H "Content-Type: application/json" `
  --data-binary "@C:\Users\Alec\mensagem.json" `
  http://167.126.20.64:8080/api/messages
```

Com `AI_PROVIDER=echo`, a resposta vem com `[echo] Recebi: ...`, sem gastar cota.

## Diagnóstico por sintoma

| Sintoma                                | Onde está a causa                                |
| -------------------------------------- | ------------------------------------------------ |
| `cd.yml` não aparece na aba Actions    | não chegou na branch padrão                      |
| `manifest unknown` no `pull`           | login ok; a imagem não foi publicada             |
| `unauthorized` no `pull`               | login falhou, ou o token foi revogado            |
| `node: not found` no `migrate-core`    | a imagem baixada não é a do Core                 |
| `required variable IMAGE_CORE missing` | o `.env` da VM não foi lido                      |
| `getaddrinfo ENOTFOUND postgres`       | o Postgres saiu da rede `omnia-db`               |
| `"database": "down"` no health check   | a senha do `.env` ≠ a do banco                   |
| `core` reiniciando em loop             | `DATABASE_URL` errada, ou migration não aplicada |
| `web` responde 502                     | o Core não está healthy                          |
| `migrate-core exited (1)`              | ver o log do container                           |

### Onde ver o log de cada container

```bash
docker logs omnia-migrate-core-1
docker logs omnia-core-1
docker logs omnia-db-1
```

O log do `migrate-core` é o mais informativo quando a falha é de banco. Ele
mostra o SQL que falhou **e** a causa, que vem em uma linha separada:

```
[Core] Falha ao aplicar migrations: Failed query:
ALTER TABLE "suggestions" ADD CONSTRAINT ...

[Core] Causa: <mensagem do Postgres>
```

### Quando o healthcheck do banco trava

O serviço `db` fica em `Waiting` quando o `pg_isready` não responde. Quase sempre
é DNS: o Postgres saiu da rede externa.

```bash
docker network inspect omnia-db --format '{{range .Containers}}{{.Name}} {{end}}'
```

Se `omnia-postgres` não aparecer:

```bash
sudo docker network connect --alias postgres omnia-db omnia-postgres
```

Depois, derruba o container velho, que fica em loop:

```bash
docker rm -f omnia-db-1
```

## Reverter

Como o `deploy.sh` grava a tag no `.env`, voltar uma versão é rodar o script de
novo com o sha anterior:

```bash
cd /srv/omnia/homolog
IMAGE_CORE=ghcr.io/healthdevio/chat-core:<sha-antigo> \
IMAGE_WEB=ghcr.io/healthdevio/chat-web:<sha-antigo> \
  ./deploy.sh /srv/omnia/homolog
```

Vale para o **código**. Migration já aplicada não é revertida ao trocar a tag — o
Drizzle não tem `down`. Se a versão antiga não roda com o schema novo, o rollback
é restaurar o volume do Postgres, não só a imagem.

Por isso a tag é por commit: é o que torna o rollback possível.

## Limpeza de disco

Cada build deixa layers antigas. No Portainer:

**Prune** remove só as imagens `Dangling` — layers sem tag, de builds
substituídos. Risco zero.

Para remover versões antigas do Omnia, no Portainer, mantendo apenas as duas
imagens em uso:

```
ghcr.io/healthdevio/chat-core:<tag atual>
ghcr.io/healthdevio/chat-web:<tag atual>
```

**Nunca** remover `pgvector/pgvector:pg16`, `postgres:16-alpine`,
`portainer/portainer-ce:lts` e `dbeaver/cloudbeaver:latest`: são as imagens dos
containers em uso.

## Manutenção da VM

| Ação                            | Frequência                      |
| ------------------------------- | ------------------------------- |
| `docker system df` para ver uso | quando o disco apertar          |
| Prune de imagens dangling       | mensal                          |
| Verificar containers parados    | mensal                          |
| Rotacionar o token do ghcr      | a cada 90 dias (expira sozinho) |
| Backup do volume do Postgres    | conforme a política de dados    |

## Documentos relacionados

| Documento                              | Assunto                     |
| -------------------------------------- | --------------------------- |
| [deploy.md](deploy.md)                 | o que acontece na VM        |
| [publicacao.md](publicacao.md)         | build e publicação          |
| [pre-requisitos.md](pre-requisitos.md) | o que precisa existir antes |
