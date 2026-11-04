# Chat Omnia

Monorepo para um chat de IA com interface React, API Node.js/NestJS e persistência
PostgreSQL. O repositório também contém migrations de uma futura base de
conhecimento e workflows de CI/CD.

> **Estado atual:** a interface é um protótipo visual com respostas locais. A
> API do chat existe separadamente, exige autenticação OIDC e ainda não está
> conectada à interface.

## Conteúdo

- [Componentes](#componentes)
- [Executar localmente](#executar-localmente)
- [API e autenticação](#api-e-autenticação)
- [AI providers](#ai-providers)
- [Comandos de desenvolvimento](#comandos-de-desenvolvimento)
- [CI/CD](#cicd)
- [Documentação](#documentação)

## Componentes

| Caminho                    | Função                                            | Estado                                               |
| -------------------------- | ------------------------------------------------- | ---------------------------------------------------- |
| `apps/chat-omnia/`         | Interface React, Vite e Tailwind                  | Protótipo local; ainda não chama a API               |
| `apps/chat-back/`          | API NestJS, Drizzle, PostgreSQL e providers de AI | Implementada; endpoints protegidos por JWT OIDC      |
| `apps/packages/knowledge/` | Schema e migrations da base de conhecimento       | Ainda não integrada ao fluxo do chat                 |
| `apps/docker/`             | Compose local, Dockerfiles, nginx e stack Swarm   | Em evolução; consulte a ressalva de CD abaixo        |
| `.github/workflows/`       | CI e publicação de imagens                        | CI em `develop` e `main`; CD configurado para `main` |

## Executar localmente

### Requisitos

- Node.js 24 ou compatível com os lockfiles do projeto.
- npm.
- Docker Engine com Docker Compose.

### 1. Iniciar o PostgreSQL

Crie `apps/docker/.env` com uma senha local:

```dotenv
POSTGRES_PASSWORD=uma-senha-local
```

Suba o serviço de banco a partir da raiz do repositório:

```bash
docker compose --env-file apps/docker/.env -f apps/docker/docker-compose.yml up -d postgres
```

O banco fica disponível em `localhost:5433`. O Compose persiste os dados no
volume `omnia_postgres_data`.

### 2. Iniciar a API

Em outro terminal:

```bash
cd apps/chat-back
npm ci
cp .env.example .env
```

Confirme que `DATABASE_URL` em `.env` usa a senha informada acima. A URL padrão
do exemplo aponta para `localhost:5433`.

```bash
npm run migrate
npm run dev
```

O Core inicia em <http://localhost:3001>. O exemplo configura `AI_PROVIDER=echo`
e deixa os valores OIDC vazios. O health check funciona; os endpoints protegidos
respondem `401` até que `OIDC_ISSUER`, `OIDC_AUDIENCE` e `OIDC_JWKS_URL` sejam
configurados para um provedor OIDC válido.

### 3. Iniciar a interface

Em um terceiro terminal:

```bash
cd apps/chat-omnia
npm ci
npm run dev
```

Abra <http://localhost:5173>. A interface usa uma resposta local de demonstração;
ela não chama a API do Core neste momento.

### Endereços locais

| Serviço      | Endereço                            | Observação                       |
| ------------ | ----------------------------------- | -------------------------------- |
| Interface    | <http://localhost:5173>             | Servidor de desenvolvimento Vite |
| API          | <http://localhost:3001>             | `CORE_PORT` no `.env` do backend |
| Health check | <http://localhost:3001/health/live> | Não exige autenticação           |
| PostgreSQL   | `localhost:5433`                    | Porta local do Compose           |

## API e autenticação

A API deriva o usuário do claim `sub` de um JWT OIDC assinado. Ela valida
assinatura, issuer, audience e expiração através da JWKS configurada. Headers
`X-User-Id` e `X-Tenant-Id` não substituem a autenticação Bearer.

Endpoints principais:

| Método   | Caminho                      | Uso                                                      |
| -------- | ---------------------------- | -------------------------------------------------------- |
| `GET`    | `/health`                    | Estado da API e do banco                                 |
| `GET`    | `/health/ready`              | Prontidão; retorna `503` se o banco estiver indisponível |
| `GET`    | `/health/live`               | Liveness da API                                          |
| `POST`   | `/api/messages`              | Envia mensagem e recebe resposta e sugestões             |
| `GET`    | `/api/conversations/current` | Conversa ativa e histórico do usuário autenticado        |
| `GET`    | `/api/conversations/active`  | Conversa ativa do usuário autenticado                    |
| `POST`   | `/api/conversations/rotate`  | Encerra a conversa atual e inicia outra                  |
| `GET`    | `/api/suggestions`           | Sugestões ativas do usuário autenticado                  |
| `POST`   | `/api/suggestions`           | Registra sugestões validadas                             |
| `DELETE` | `/api/suggestions`           | Limpa sugestões ativas                                   |

Consulte [apps/chat-back/README.md](apps/chat-back/README.md) para os contratos,
configurações e detalhes dos endpoints.

## AI providers

O backend inclui dois providers:

- `echo`: resposta de demonstração sem chamada a um modelo externo; é o padrão
  do `.env.example`.
- `nvidia`: NVIDIA NIM, compatível com a API da OpenAI; requer `NVIDIA_API_KEY`.

Configurações adicionais, como modelo, timeout e limite de tokens, estão em
`apps/chat-back/.env.example`. `AI_IGNORE_CONFIG=1` ignora a configuração de
idioma, tom e tamanho; `AI_NO_SUGGESTIONS=1` desativa sugestões.

## Comandos de desenvolvimento

Os comandos de cada app devem ser executados no diretório indicado.

```bash
# API — apps/chat-back
npm run dev
npm run typecheck
npm test
npm run build
npm run migrate

# Interface — apps/chat-omnia
npm run dev
npm run typecheck
npm run lint
npm run build

# Raiz do repositório
npm ci
npm run format:check
npm run format
```

`npm run format` altera arquivos. `npm run format:check` apenas verifica a
formatação e é o comando usado pela CI.

## CI/CD

### CI

O workflow [`.github/workflows/ci.yml`](.github/workflows/ci.yml) roda em push e
Pull Request para `develop` e `main`. Ele valida a interface, o backend, a
formatação Prettier e as imagens Docker, incluindo scan Trivy para vulnerabilidades
`HIGH` e `CRITICAL`.

### CD

O workflow [`.github/workflows/cd.yml`](.github/workflows/cd.yml) publica imagens
no registry PW2C depois de uma CI bem-sucedida em `main`. A atualização da stack
do Portainer continua manual.

Há diferenças entre os arquivos de CI de `main` e `develop`, e uma inconsistência
no caminho do Dockerfile de backend usado pelo CD. Veja
[comparação de CI/CD entre main e develop](docs/ci_cd/diferencas-ci-cd-main-develop.md)
antes de depender da publicação automática.

## Documentação

- [Índice da documentação](docs/README.md)
- [Fluxo Git: branch, commit, push e PR](docs/estrutura/fluxo-de-commits-e-push.md)
- [Comparação de CI/CD entre `main` e `develop`](docs/ci_cd/diferencas-ci-cd-main-develop.md)
- [Diagnóstico de problemas de CI/CD](docs/ci_cd/problemas/README.md)
- [Resolução das falhas recentes do CI do chat-back](docs/ci_cd/problemas/resolucao-ci-chat-back-oidc-trivy.md)
- [Documentação da interface](docs/interface/README.md)
- [Documentação da API](apps/chat-back/README.md)
