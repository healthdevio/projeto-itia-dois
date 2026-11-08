# Chat Omnia

Chat Omnia é um projeto de chat com interface web, API própria, persistência de
conversas e integração configurável com provedores de IA. O repositório reúne
aplicações, infraestrutura Docker e workflows de CI/CD.

> **Estado atual:** a API do chat está implementada, mas a interface web ainda
> usa uma resposta local de demonstração e não está conectada à API. A base de
> conhecimento também está em desenvolvimento e não participa do fluxo atual.

## Componentes

| Caminho                    | Responsabilidade                                                       |
| -------------------------- | ---------------------------------------------------------------------- |
| `apps/chat-omnia/`         | Interface React, TypeScript, Vite e Tailwind.                          |
| `apps/chat-back/`          | API NestJS, autenticação OIDC, conversas, mensagens e sugestões.       |
| `apps/packages/knowledge/` | Schema e migrations preliminares para uma base de conhecimento.        |
| `apps/docker/`             | Dockerfiles, Compose local, Nginx, stack Swarm e scripts operacionais. |
| `.github/workflows/`       | CI, publicação de imagens e verificações de segurança.                 |
| `docs/`                    | Documentação de arquitetura, interface, API e operação.                |

## Começar localmente

### Requisitos

- Node.js 24 para reproduzir a configuração do CI e npm. Os Dockerfiles atuais
  usam Node.js 26.
- Docker Engine com Docker Compose para executar PostgreSQL localmente.

### 1. Iniciar o banco

Crie `apps/docker/.env` localmente com uma senha de desenvolvimento:

```dotenv
POSTGRES_PASSWORD=use-uma-senha-local
```

Inicie o PostgreSQL a partir da raiz:

```bash
docker compose --env-file apps/docker/.env -f apps/docker/docker-compose.yml up -d postgres
```

O banco fica disponível em `localhost:5433`.

### 2. Iniciar a API

Em outro terminal:

```bash
cd apps/chat-back
npm ci
```

Crie `apps/chat-back/.env` com base em `.env.example` e configure a conexão
local do banco. Para a primeira execução, use o provider de demonstração `echo`.
Depois execute:

```bash
npm run db:migrate
npm run start:dev
```

A API fica em <http://localhost:3001>. O health check público é
<http://localhost:3001/health/live>. As rotas de conversa, mensagem e sugestão
exigem autenticação OIDC; configure `OIDC_ISSUER`, `OIDC_AUDIENCE` e
`OIDC_JWKS_URL` para usar essas rotas.

### 3. Iniciar a interface

Em outro terminal:

```bash
cd apps/chat-omnia
npm ci
npm run dev
```

Abra <http://localhost:5173>. A interface atualmente mostra uma resposta local
de demonstração; iniciar a API não a conecta automaticamente ao backend.

## API e IA

As rotas principais do backend incluem:

| Método   | Rota                         | Descrição                                |
| -------- | ---------------------------- | ---------------------------------------- |
| `GET`    | `/health`                    | Estado da API e dependências.            |
| `GET`    | `/health/ready`              | Readiness, incluindo o banco.            |
| `GET`    | `/health/live`               | Liveness da API.                         |
| `POST`   | `/api/messages`              | Envia uma mensagem ao provider de IA.    |
| `GET`    | `/api/conversations/current` | Consulta conversa e histórico atuais.    |
| `GET`    | `/api/conversations/active`  | Consulta a conversa ativa.               |
| `POST`   | `/api/conversations/rotate`  | Encerra a conversa atual e inicia outra. |
| `GET`    | `/api/suggestions`           | Consulta sugestões ativas.               |
| `POST`   | `/api/suggestions`           | Registra sugestões validadas.            |
| `DELETE` | `/api/suggestions`           | Limpa sugestões ativas.                  |

As rotas protegidas validam JWT OIDC (assinatura, issuer, audience e expiração)
por meio de JWKS. O identificador do usuário vem do claim `sub`; headers
arbitrários de identidade enviados pelo cliente não substituem o token.

O backend oferece:

- `echo`: provider local de demonstração, sem chamada a modelo externo.
- `nvidia`: integração com NVIDIA NIM; requer `NVIDIA_API_KEY`.

As conversas, mensagens e sugestões são persistidas em PostgreSQL via Drizzle.
Os valores de ambiente estão descritos em `apps/chat-back/.env.example`; use
secrets locais ou do ambiente de deploy, nunca inclua credenciais no código.

## Desenvolvimento, testes e formatação

Execute os comandos dentro da aplicação correspondente:

```bash
# Backend — apps/chat-back
npm ci
npm run typecheck
npm test
npm run test:e2e
npm run build

# Interface — apps/chat-omnia
npm ci
npm run typecheck
npm run lint
npm run build
```

Na raiz do repositório:

```bash
npm ci
npm run format:check
npm run format
```

`npm run format` **altera arquivos** usando Prettier; use `npm run format:check`
para apenas verificar. Em Pull Requests para `develop` e `main`, a CI executa a
verificação sem escrita. Se falhar, rode `npm run format` localmente e envie um
novo commit. A CI não cria commits de formatação.

O script `npm test` na raiz é apenas um placeholder; execute os testes do
backend em `apps/chat-back`. A pasta `apps/packages/knowledge` possui lockfile,
schema e migrations próprios, mas ainda não é um workspace npm integrado ao
fluxo principal.

## Docker e CI/CD

O Compose em `apps/docker/docker-compose.yml` inicia o PostgreSQL para
desenvolvimento. A stack `apps/docker/pw2c/docker-stack.yml` descreve o ambiente
Swarm com PostgreSQL, API e interface servida por Nginx. O Nginx encaminha
`/api` para o serviço `core`.

O CI roda em Pull Requests e pushes para `develop` e `main`; valida interface e
backend, roda testes, verifica a formatação e constrói imagens Docker. O CD é
acionado após uma CI bem-sucedida em `main`, publica imagens e executa scan de
vulnerabilidades. O redeploy via webhooks do Portainer depende da configuração
explícita de `DEPLOY_ENABLED`.

Os workflows também incluem varredura de segredos, CodeQL, revisão de
dependências e validação de workflows. A configuração presente no checkout
local pode ainda não estar publicada no GitHub; confirme o branch e os checks
ativos antes de depender de uma execução.

## Documentação

- [Índice da documentação](docs/README.md)
- [Contratos e rotas do Core](docs/core/README.md)
- [Interface e componentes](docs/interface/README.md)
- [CI/CD e operação](docs/ci_cd/README.md)
- [Estrutura, testes e versionamento](docs/estrutura/README.md)
- [Implementação de segurança nos workflows](docs/implementacao-nova-seguranca/README.md)
