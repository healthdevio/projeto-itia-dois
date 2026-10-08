# Deploy

Passo a passo do deploy na VM. **O `cd.yml` ainda não existe** — o que está
descrito aqui é a etapa manual.

## A VM

```
host     ubuntu@167.126.20.64
usuário  ubuntu (com sudo)
```

Docker já instalado. Rodando: `omnia-postgres`, `cloudbeaver`, `portainer`.

## O que já está pronto

Verificado em 8 de outubro de 2026:

| Item                        | Onde                                     | Estado                             |
| --------------------------- | ---------------------------------------- | ---------------------------------- |
| `.env`                      | `/srv/omnia/homolog` e `/srv/omnia/prod` | criado, senha resolvendo           |
| `docker-compose.deploy.yml` | ambos                                    | copiado                            |
| `deploy.sh`                 | ambos                                    | copiado e executável               |
| Permissões                  | `/srv/omnia`                             | `ubuntu:ubuntu`                    |
| Rede `omnia-db`             | Docker                                   | criada, `omnia-postgres` conectado |

O `docker compose config` sai com código 0.

## Conectar o Postgres à rede (feito)

O banco é gerenciado pelo Portainer e vive na rede padrão dele. O compose do
Omnia não o cria — só o alcança, pela rede externa `omnia-db`:

```bash
sudo docker network create omnia-db
sudo docker network connect omnia-db omnia-postgres
sudo docker network inspect omnia-db --format '{{range .Containers}}{{.Name}} {{end}}'
```

O último comando deve mostrar `omnia-postgres`.

**Repita o `connect` sempre que o Portainer recriar o Postgres** — recriar o
container tira ele da rede, e o Core passa a falhar com
`getaddrinfo ENOTFOUND postgres` sem indicação do motivo.

### Se der "already exists"

Não é erro:

```console
Error response from daemon: network with name omnia-db already exists
Error response from daemon: endpoint with name omnia-postgres already exists in network omnia-db
omnia-postgres
```

O `inspect` é o que confirma. As mensagens só dizem que já estava pronto.

## Permissões (feito)

`sudo mkdir` cria a pasta com o grupo do pai, que na VM é `root`. O `scp` roda
como `ubuntu`, então ele lia a pasta mas não escrevia:

```console
$ ls -ld /srv/omnia/homolog
drwxr-xr-x 2 ubuntu root 4096 /srv/omnia/homolog
                   ^^^^^
```

Corrigido:

```bash
sudo chown -R $USER:$USER /srv/omnia
chmod +x /srv/omnia/*/deploy.sh
```

## Transferir arquivos do Windows

```powershell
cd C:\Users\Alec\Documents\projeto-chat-mia
scp -i "C:\Users\Alec\Downloads\ssh-key-2026-09-22.key" `
  apps/docker/docker-compose.deploy.yml apps/docker/deploy.sh `
  ubuntu@167.126.20.64:/srv/omnia/homolog/
```

O `cd` no repositório é obrigatório: sem ele o erro é
`stat local "...": No such file or directory`, e parece que o problema é na VM.

## Login no registry (uma vez)

```bash
echo "$GHCR_TOKEN" | sudo docker login ghcr.io -u SEU_USUARIO --password-stdin
```

`GITHUB_TOKEN` do repositório serve, com escopo `read:packages`. Para **push**,
`write:packages`.

## Fazer o deploy

```bash
cd /srv/omnia/prod
IMAGE_CORE=ghcr.io/healthdevio/chat-core:abc1234 \
IMAGE_WEB=ghcr.io/healthdevio/chat-omnia:abc1234 \
  ./deploy.sh /srv/omnia/prod
```

Os 7 primeiros caracteres do commit. **Nunca `latest`**: sem número de versão não
há como voltar atrás.

### Ainda vai falhar

As imagens não foram publicadas ainda. O erro é:

```
manifest unknown: manifest tagged by "main" does not exist
```

Isso só se resolve com o `cd.yml`.

## O que o deploy.sh faz

1. Cria a rede `omnia-db` se não existir
2. Reescreve `IMAGE_CORE` e `IMAGE_WEB` no `.env`
3. `docker compose pull`
4. `docker compose up -d --remove-orphans`
5. `docker compose ps`

**A senha ele nunca toca.** Só as 3 linhas `IMAGE_*`.

**Por que a tag vai para dentro do `.env`:** `up -d` sem `--pull` reusa a imagem
que já está na máquina. Passar a tag por variável resolveria o `pull`, mas
deixaria o `.env` descrevendo uma versão diferente da que está rodando — e o
próximo `up` manual voltaria para a tag antiga sem ninguém perceber.

## Verificar

```bash
cd /srv/omnia/prod
docker compose --env-file .env -f docker-compose.deploy.yml ps
```

Todos `running` ou `healthy`. `db` e `migrate-core` em `exited (0)`.

```bash
curl -s http://localhost:80/
```

O health check do Core responde:

```json
{ "status": "ok", "service": "chat-ai-core", "database": "up" }
```

## Diagnóstico

```bash
docker compose --env-file .env -f docker-compose.deploy.yml logs -f core
docker compose --env-file .env -f docker-compose.deploy.yml logs migrate-core
```

| Sintoma                          | Causa                                            |
| -------------------------------- | ------------------------------------------------ |
| `manifest unknown`               | imagem não publicada (falta o `cd.yml`)          |
| `getaddrinfo ENOTFOUND postgres` | `omnia-postgres` saiu da `omnia-db`              |
| `"database": "down"`             | senha do `.env` ≠ a do banco                     |
| `core` reiniciando               | `DATABASE_URL` errada, ou migration não aplicada |
| `web` responde 502               | `core` não está healthy                          |
| `migrate-core exited (1)`        | migration que falha; ver o log                   |
| interface serve versão antiga    | `index.html` em cache no navegador               |

## Rollback

```bash
IMAGE_CORE=ghcr.io/healthdevio/chat-core:<sha-antigo> \
IMAGE_WEB=ghcr.io/healthdevio/chat-omnia:<sha-antigo> \
  ./deploy.sh /srv/omnia/prod
```

Vale para o **código**. Migration já aplicada não é revertida ao trocar a tag —
o Drizzle não tem `down`. Se a versão antiga não roda com o schema novo, o
rollback é restaurar o volume do Postgres, não só a imagem.

Por isso a tag é por commit, e não `latest`: é o que torna o rollback possível.
