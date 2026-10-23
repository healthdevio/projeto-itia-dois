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

Cluster da PW2C provisionado e operacional. Container **core** running no compute01 há 2+ minutos (estável, não mais loop starting→complete). Todas as env vars confirmadas no Portainer (POSTGRES_PASSWORD=omniabanco2026, POSTGRES_USER=omnia_user, etc.). Health endpoint `/health` implementado e funcionando após redeploy. PR #54 equivalente já fez commit e push no branch `feat/health-check-novas-mudancas` → `develop`. `npm run format:check` passa em todos os arquivos modificados. Endpoint `/health` deve funcionar após o próximo redeploy no Portainer.

## Stack

| Camada | Tecnologia | Para que serve | Por que foi escolhida |
| -------- | ---------- | -------------- | --------------------- |
| **Interface** | React + Vite + Tailwind CSS + shadcn/ui | Biblioteca para construir interfaces em componentes reutilizáveis | Componentes reutilizáveis garantem consistência visual entre as telas de chat (botão, janela, mensagens, campo de envio) e permitem adaptacões visuais independentes. |
| **API** | Hono + TypeScript | Framework web lightweight para construir APIs | Performance elevada com TypeScript — contratos (Message, Conversation, ChatRequest) ficam tipados, detectando erros em compile-time. |
| **Banco** | PostgreSQL + pgvector + Drizzle ORM | Banco relacional com extensão de busca vetorial | PostgreSQL estrutura dados, pgvector habilita busca de similaridade para RAG, Drizzle ORM fornece type-safe queries e migrations simples. |
| **AI** | LangChain + NVIDIA (com provider `echo` para teste) | Orquestração de conexão com LLMs e dados externos | Acesso a múltiplos provedores de LLM e simplificação da integração com APIs, dados e memória de conversa via vector store. |
| **Infra** | Docker Swarm + Portainer CE + GitHub Actions | Orquestração e deploy no cluster PW2C | Ambientes reproduzíveis via containers; CI/CD automático com format auto-fix, typecheck e build de imagens antes do deploy. |
