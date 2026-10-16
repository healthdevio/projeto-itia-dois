# Projeto Omnia IA

Chat com IA. Monorepo com a interface (`apps/chat-omnia`), a API (`apps/chat-core`),
o pacote de conhecimento (`apps/packages/knowledge`) e a infraestrutura
(`apps/docker`).

## Por onde começar

| Você quer...               | Leia                                                                                      |
| -------------------------- | ----------------------------------------------------------------------------------------- |
| _entender a pipeline_      | [`docs/ci_cd/`](../docs/ci_cd/README.md)                                                  |
| _diagnosticar um erro_     | [`docs/ci_cd/problemas/`](../docs/ci_cd/problemas/README.md)                              |
| _usar a API_               | [`docs/core/`](../docs/core/README.md)                                                    |
| _entender o versionamento_ | [`docs/estrutura/fluxo_de_versionamento.md`](../docs/estrutura/fluxo_de_versionamento.md) |
| _rodar localmente_         | [Pré-requisitos](../docs/ci_cd/pre-requisitos.md)                                         |

## Apps

| Pasta                     | O quê                         |
| ------------------------- | ----------------------------- |
| `apps/chat-omnia`         | interface React (Vite)        |
| `apps/chat-core`          | API Hono + Postgres (Drizzle) |
| `apps/packages/knowledge` | base de conhecimento e RAG    |
| `apps/docker`             | imagens, compose e deploy     |

## Estado

O cluster da PW2C ainda não foi provisionado. O deploy está escrito, mas nunca
rodou.

O frontend ainda usa estado local e não chama a API — os `transport/` estão
vazios. A AI está em `AI_PROVIDER=echo`, que responde texto fixo sem gastar cota.

## Stack

| Camada    | Tecnologia                                                                  |
| --------- | --------------------------------------------------------------------------- |
| Interface | React 19, Vite 8, Tailwind 4                                                |
| API       | Hono, Node 22, TypeScript                                                   |
| Banco     | PostgreSQL 16 + pgvector, Drizzle ORM                                       |
| AI        | NVIDIA NIM (compatível com a API da OpenAI), com provider `echo` para teste |
| Infra     | Docker Swarm, registry da PW2C, Portainer CE, GitHub Actions                |
