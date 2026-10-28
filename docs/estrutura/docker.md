# Docker e imagens

Os arquivos de container ficam em `apps/docker/`. O repositório contém Dockerfiles, um compose local e uma stack Docker Swarm. Os nomes de backend, serviço e imagem foram alinhados nesta revisão; ainda precisam ser verificados por build e deploy em ambiente de validação.

## Arquivos

| Arquivo                 | Uso declarado                                                                                       |
| ----------------------- | --------------------------------------------------------------------------------------------------- |
| `Dockerfile.core`       | Imagem da API e migrations a partir de `apps/chat-back`.                                            |
| `Dockerfile.web`        | Build Vite e nginx para servir a interface e encaminhar `/api`.                                     |
| `Dockerfile.knowledge`  | Imagem de migrations do pacote `knowledge`; não está no deploy principal descrito pela stack atual. |
| `Dockerfile`            | Imagem usada pelo serviço `migrations` no compose local.                                            |
| `docker-compose.yml`    | Postgres local e serviço de migrations; não inicia backend nem frontend.                            |
| `pw2c/docker-stack.yml` | Stack Swarm.                                                                                        |
| `nginx.conf`            | Proxy do frontend para o backend e entrega de assets.                                               |
| `entrypoint.sh`         | Espera o banco, executa migrations e inicia o backend.                                              |

## Inconsistências que bloqueiam o deploy

Os arquivos agora usam `apps/chat-back`, imagem `chat-core` e serviço `core`. Valide o build e a resolução de DNS do serviço no Swarm antes de atualizar a stack.

## Comportamento previsto das imagens

`Dockerfile.core` usa múltiplas etapas para compilar o TypeScript e montar uma imagem runtime. Ele define health check e usa o usuário não-root `node`. Essa descrição só será válida após o caminho de origem ser corrigido e o build ter sucesso.

`Dockerfile.web` compila o frontend com Vite e serve o conteúdo estático via nginx. O nginx encaminha `/api` para o serviço backend; o hostname no proxy precisa corresponder ao nome do serviço no Swarm.

O `entrypoint.sh` espera o Postgres via `pg_isready`, roda `dist/db/migrate.js` e inicia o servidor. No Swarm, mantenha uma única réplica de backend enquanto as migrations forem aplicadas no start.

## Dados do Postgres

A stack usa um volume local do Docker e fixa o serviço Postgres no nó `compute01`. O volume não migra entre nós. Mover ou perder esse nó requer restauração de backup ou migração explícita dos dados. Mantenha backups fora do nó e teste a restauração.

## Segurança

O backend valida JWT Bearer com `OIDC_ISSUER`, `OIDC_AUDIENCE` e `OIDC_JWKS_URL`, e deriva a identidade do `sub`. Configure estes valores e integre a interface ao provedor antes de liberar usuários reais.

## Verificação de configuração

Para o compose local:

```bash
docker compose -f apps/docker/docker-compose.yml config
```

Para a stack Swarm, confira nomes de serviços, imagens e variáveis em `apps/docker/pw2c/docker-stack.yml` e compare com `.github/workflows/cd.yml` antes de aplicar no Portainer.
