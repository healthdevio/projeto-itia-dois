# Chat Omnia

Chat com IA, monorepo com interface React, API Hono, base de conhecimento com
pgvector e entrega contínua até a VM. A `develop` vira homologação, a `main`
vira produção, e o mesmo pushmove o código.

## Início rápido

Requisitos: Node.js 24 e npm 11. Docker para o banco.

```bash
# 1. o banco
cp apps/docker/.env.dev apps/docker/.env    # preencha POSTGRES_PASSWORD
docker compose -f apps/docker/docker-compose.yml up -d

# 2. o Core
cd apps/chat-core
npm install
cp .env.example .env                        # preencha DATABASE_URL
npm run migrate
npm run dev

# 3. a interface
cd apps/chat-omnia
npm install
npm run dev
```

Essas portas valem só para o desenvolvimento local, com os dois servidores do
Vite e do Node na sua máquina:

| Serviço      | Endereço                | Vem de                          |
| ------------ | ----------------------- | ------------------------------- |
| Interface    | <http://localhost:5173> | default do Vite                 |
| API          | <http://localhost:3001> | `CORE_PORT` no `.env` do Core   |
| Health check | <http://localhost:3001> | mesma rota do Core              |
| Postgres     | `localhost:5433`        | `'5433:5432'` no compose de dev |

Quem usa o sistema de verdade não acessa nenhuma delas. Em homologação e
produção a entrada é o nginx, e a API **não tem porta publicada** — ela só
existe dentro da rede do compose. Ver
[entrega contínua](#entrega-contínua).

## O que o sistema faz

O usuário manda uma mensagem. O Core guarda a conversa, monta o contexto e
pergunta à AI; a resposta volta com sugestões e as duas coisas são persistidas.
No próximo envio, o histórico entra no prompt — é ele que dá continuidade à
conversa.

Em produção e homologação o caminho passa pelo nginx, que serve o bundle da
interface e encaminha `/api` para o Core. No desenvolvimento local não há proxy:
a interface fala direto com a API.

```
navegador ──/api/...──> nginx ──> core ──> AI provider
                            │              │
                            │              └── devolve { response, suggestions }
                            └── grava conversa, mensagens e sugestões no Postgres
```

**A conversa nunca vai para a AI.** Ela é estado interno do Core. Apenas as
mensagens saem, e cada envio carrega o contexto do diálogo.

Cada usuário tem a própria conversa, resolvida pelo header `X-User-Id`. Um Core
atende várias pessoas sem misturar histórico.

## Componentes

```text
apps/chat-omnia/         Interface React, Vite, Tailwind
apps/chat-core/          API Hono, Drizzle, Postgres
apps/packages/knowledge/ Base de conhecimento, embeddings e RAG
apps/packages/omnia-ai/  Context, memória, perfil, ferramentas
apps/packages/sdk/       Contratos e componentes compartilhados
apps/docker/             Dockerfiles, compose, nginx e deploy
```

Os três últimos pacotes são esboços: só `.gitkeep`, sem código. O caminho está
reservado e documentado, mas o que roda hoje é o Core e a interface.

O `knowledge` tem as migrations e o schema prontos, mas não entra no compose de
deploy — as tabelas que ele cria não são lidas por nada ainda. Ver
[Conhecimento](#conhecimento) adiante.

## Arquitetura

### Divisão de responsabilidade

| Camada      | O que faz                                             | O que não faz                       |
| ----------- | ----------------------------------------------------- | ----------------------------------- |
| Interface   | Renderiza, envia mensagem, escolhe idioma/tom/tamanho | Não conversa com AI nem sabe modelo |
| Core        | Guarda estado, monta contexto, chama AI, persiste     | Não sabe qual modelo responde       |
| AI provider | Responde e devolve sugestões                          | Não sabe o que é conversa           |
| Postgres    | Fonte da verdade                                      | —                                   |

O Core monta `{ message, context, config }` e recebe `{ response, suggestions }`.
Ele não conhece modelo, provider nem prompt. Trocar a AI é trocar a implementação
de `AIProvider` — nenhuma outra camada muda.

### Estado da conversa

O Core guarda a conversa ativa por usuário. Ela tem estados — `active`,
`rotated` — e as mensagens têm papel de `user` ou `omnia`. O contrato completo
está em [`docs/core/`](docs/core/README.md).

```
GET  /api/conversations/current   conversa ativa
GET  /api/conversations/active    id da conversa ativa
POST /api/conversations/rotate    encerra e abre outra
POST /api/messages                envia mensagem e recebe resposta
GET  /api/suggestions             sugestões da conversa
```

## AI

O provider padrão é a NVIDIA NIM, compatível com a API da OpenAI. O
`AI_PROVIDER=echo` responde texto fixo sem chamar modelo nenhum — é o que roda
em homologação, porque não gasta cota.

```
AI_PROVIDER=nvidia    modelo real
AI_PROVIDER=echo      texto fixo, sem rede
```

Duas flags existem para exercitar caminhos que a AI ainda não cobre:
`AI_IGNORE_CONFIG=1` ignora o idioma/tom/tamanho, e `AI_NO_SUGGESTIONS=1`
devolve resposta sem sugestões.

O timeout é alto de propósito. A NVIDIA devolve token a token e uma resposta
longa passa dos 60 s sem que nada esteja errado; com teto curto, a requisição
era cortada no meio da digitação.

## Comandos

Os comandos rodam dentro de cada app. Não há workspace npm na raiz.

```bash
# Core
cd apps/chat-core
npm run dev          # hot reload
npm run build        # tsc
npm run test         # 95 testes, node:test via tsx
npm run typecheck    # src e test
npm run migrate      # aplica as migrations

# Interface
cd apps/chat-omnia
npm run dev
npm run build
npm run lint

# raiz
npm run format       # prettier --write .
npm run format:check # prettier --check .
```

O `format` da raiz vale para o repositório inteiro — é por isso que existe
`format:check` na raiz e não em cada app.

## Entrega contínua

```
push ──> CI ──> CD ──> ghcr.io ──> deploy na VM
```

A CI valida quatro coisas em paralelo — frontend, Core, formatação e build das
imagens Docker. Passando, o CD constrói as imagens, publica no `ghcr.io` e
entra por SSH na VM para subir o compose.

Quem usa o sistema entra por aqui — não pela tabela de cima:

| Branch    | Ambiente    | `.env`     | Endereço                    | Porta  |
| --------- | ----------- | ---------- | --------------------------- | ------ |
| `develop` | homologação | `homolog/` | <http://167.126.20.64:8080> | `8080` |
| `main`    | produção    | `prod/`    | <http://167.126.20.64>      | `80`   |

O compose é o mesmo nos dois ambientes. O que os separa é o `.env` — a porta que
o nginx escuta, a imagem e as variáveis de AI.

**Só o nginx tem porta.** Quem fala com o navegador é ele; o Core e o Postgres
não são publicados. O Core existe apenas dentro da rede `omnia-db`, e o Postgres
vive fora dela, gerenciado pelo Portainer. Ver
[pré-requisitos](docs/ci_cd/pre-requisitos.md).

O processo inteiro está em [`docs/ci_cd/`](docs/ci_cd/README.md).

## Conhecimento

`apps/packages/knowledge` tem schema, migrations e o desenho do RAG. Não entra
no deploy: as tabelas que ele cria não são lidas por nada ainda, e subir
migrations que nada consome só adiciona uma etapa que pode falhar.

Quando entrar, o schema de migrations precisa ser próprio — o Core já usa
`drizzle_core`, e dois pacotes Drizzle no mesmo banco com a tabela de controle
compartilhada pulam migrations. O sintoma e a causa estão em
[problemas](docs/ci_cd/problemas/README.md).

## Estado

Homologação no ar desde 8 de outubro de 2026 em
<http://167.126.20.64:8080>, alimentada por `git push`.

|             |                                           |
| ----------- | ----------------------------------------- |
| API e banco | no ar, com migrations aplicadas           |
| AI          | `AI_PROVIDER=echo` — texto fixo, sem cota |
| Interface   | **estado local, não chama a API**         |
| Produção    | não promovida; `deploy-prod` nunca rodou  |

`apps/chat-omnia/src/transport/rest` e `transport/sse` estão vazios, e a tela
usa estado mockado em `App.tsx`. O caminho nginx → Core → Postgres está validado
por `curl`; o que falta é a interface deixar de mocker e passar a chamar.

A porta do Postgres, a do Portainer e a do CloudBeaver estão expostas na VM, e
há uma senha de banco no histórico do git. Ver
[operação](docs/ci_cd/operacao.md).

## Convenções

- **Commits separados por natureza.** Teste não entra no commit de infra.
- **`develop` recebe PR; `main` recebe promoção.** Produção é merge, não push.
- **Comentário explica o porquê.** O que o código já diz, o código diz.
- **`apps/chat-omnia` não é tocado sem liberação.** Back e infra são livres.
- **`.env` nunca é versionado.** Os `.env.*` versionados são template, com a
  senha vazia.

## Documentação

| Documento                                                    | Assunto                                      |
| ------------------------------------------------------------ | -------------------------------------------- |
| [docs/README.md](docs/README.md)                             | Índice geral                                 |
| [docs/ci_cd/](docs/ci_cd/README.md)                          | Pipeline completa, do push à VM              |
| [docs/ci_cd/pre-requisitos.md](docs/ci_cd/pre-requisitos.md) | O que precisa existir antes do deploy        |
| [docs/ci_cd/deploy.md](docs/ci_cd/deploy.md)                 | O que acontece na VM, serviço por serviço    |
| [docs/ci_cd/operacao.md](docs/ci_cd/operacao.md)             | Verificar, diagnosticar e reverter           |
| [docs/ci_cd/problemas/](docs/ci_cd/problemas/README.md)      | Diagnóstico por sintoma                      |
| [docs/core/](docs/core/README.md)                            | Contrato da API                              |
| [docs/estrutura/](docs/estrutura/README.md)                  | CI, Docker, ambientes, testes, versionamento |
| [docs/interface/](docs/interface/estrutura_componentes.md)   | Componentes da interface                     |

O detalhe da API está em [`apps/chat-core/README.md`](apps/chat-core/README.md),
inclusive o contrato do `AIProvider` e o harness local de teste.
