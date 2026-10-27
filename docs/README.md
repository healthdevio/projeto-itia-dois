# Documentação do Chat Omnia

Índice da documentação do monorepo. Os arquivos abaixo descrevem o código e a infraestrutura versionados; confirme o estado do cluster diretamente no Portainer antes de executar operações.

## Por onde começar

| Objetivo                                     | Documento                                                                      |
| -------------------------------------------- | ------------------------------------------------------------------------------ |
| Entender o estado e as limitações conhecidas | [contexto do projeto](contexto/contexto-ia.md)                                 |
| Executar e revisar CI/CD                     | [CI/CD](ci_cd/README.md)                                                       |
| Operar a stack e investigar falhas           | [operação](ci_cd/operacao.md) e [problemas](ci_cd/problemas/README.md)         |
| Entender a API atual                         | [README do backend](../apps/chat-back/README.md) e [contratos](core/README.md) |
| Entender a interface                         | [documentação da interface](interface/README.md)                               |
| Entender Docker e ambientes                  | [Docker](estrutura/docker.md) e [ambientes](estrutura/ambientes.md)            |

## Componentes

| Caminho                   | Conteúdo                                                                            |
| ------------------------- | ----------------------------------------------------------------------------------- |
| `apps/chat-omnia`         | Interface React e Vite; atualmente ainda usa estado/resposta local.                 |
| `apps/chat-back`          | API Hono, persistência PostgreSQL, migrations e testes.                             |
| `apps/packages/knowledge` | Schema e migrations da base de conhecimento; não está integrado ao fluxo principal. |
| `apps/docker`             | Dockerfiles, nginx, compose local e stack Swarm.                                    |
| `.github/workflows`       | Workflows de CI e publicação de imagens.                                            |

## Estado DevOps verificado no repositório

- A CI valida frontend e backend, executa testes, verifica Prettier sem alterar arquivos e constrói as imagens.
- O CD publica somente após CI aprovada em `main`, usando o SHA do commit; a atualização da stack continua manual no Portainer.
- Dockerfile, stack, nginx e workflow estão alinhados em torno do backend `apps/chat-back`, serviço `core` e imagem `chat-core`; a primeira execução de build/deploy ainda precisa validar essa configuração.
- A stack exige `POSTGRES_PASSWORD`, usa `omnia` como banco padrão e verifica a saúde do Postgres.
- A API exige JWT OIDC verificado e deriva a identidade do claim `sub`; configure issuer, audience e JWKS antes de usar endpoints protegidos.
- A documentação histórica contém uma credencial de banco em claro. Se ela foi usada, faça rotação e verifique o histórico Git.

## Índice

| Pasta/arquivo                                                | Assunto                                                      |
| ------------------------------------------------------------ | ------------------------------------------------------------ |
| [ci_cd/](ci_cd/README.md)                                    | Pipeline, publicação, stack, operação e diagnóstico          |
| [estrutura/](estrutura/README.md)                            | CI, Docker, ambientes, testes e versionamento                |
| [core/](core/README.md)                                      | Contratos e comportamento da API                             |
| [interface/](interface/README.md)                            | Componentes e estado da interface                            |
| [contexto/](contexto/contexto-ia.md)                         | Contexto de manutenção e limitações atuais                   |
| [PROCESSO_MIGRACAO.md](PROCESSO_MIGRACAO.md)                 | Registro histórico da migração da VM para Swarm              |
| [CONTEXTO_MODELO.md](CONTEXTO_MODELO.md)                     | Contexto inicial e regras de trabalho para assistentes de IA |
| [RESUMO_PRIORIDADES_DEVOPS.md](RESUMO_PRIORIDADES_DEVOPS.md) | Mudanças aplicadas, limitações e decisões pendentes          |
| [nginx-health-check.md](nginx-health-check.md)               | Registro histórico do health check nginx/Core                |
| [changelog/](changelog/CHANGELOG.md)                         | Registros históricos de alterações                           |
