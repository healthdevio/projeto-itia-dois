# Documentação do Chat Omnia

Índice da documentação do monorepo. A estrutura descreve o código versionado; confirme configurações operacionais, secrets e estado do cluster nas plataformas correspondentes.

## Por onde começar

| Objetivo                                     | Documento                                                                                                                               |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Entender arquitetura e limitações conhecidas | [Contexto do projeto](contexto/CONTEXTO_MODELO.md)                                                                                      |
| Preparar e operar CI/CD                      | [Guia de CI/CD](ci_cd/README.md) e [ativação e operação](ci_cd/ativacao-e-operacao.md)                                                  |
| Investigar falhas de operação                | [Operação](ci_cd/operacao.md) e [problemas conhecidos](ci_cd/problemas/README.md)                                                       |
| Entender a API e seus contratos              | [README do backend](../apps/chat-back/README.md) e [contratos do Core](core/README.md)                                                  |
| Entender a interface                         | [Documentação da interface](interface/README.md)                                                                                        |
| Configurar Docker e ambientes                | [Docker](estrutura/docker.md) e [ambientes](estrutura/ambientes.md)                                                                     |
| Verificar workflows de segurança             | [Estado de segurança dos workflows](seguranca-workflows/README.md)                                                                      |
| Entender dependências e auto-merge           | [Guia do Dependabot](dependabot/README.md) e [operação do CI/CD](ci_cd/ativacao-e-operacao.md#como-funciona-o-auto-merge-do-dependabot) |

## Componentes

| Caminho                    | Conteúdo                                                                                          |
| -------------------------- | ------------------------------------------------------------------------------------------------- |
| `apps/chat-omnia/`         | Interface React/Vite; ainda apresenta resposta local de demonstração e não está conectada à API.  |
| `apps/chat-back/`          | API NestJS, persistência PostgreSQL, migrations e testes.                                         |
| `apps/packages/knowledge/` | Schema e migrations preliminares da base de conhecimento; ainda não integrada ao fluxo principal. |
| `apps/docker/`             | Dockerfiles, Nginx, Compose local, stack Swarm e scripts operacionais.                            |
| `.github/workflows/`       | CI, CD, CodeQL, Dependency Review, Gitleaks, auditoria dos workflows e auto-merge do Dependabot.  |

## Estado atual de CI/CD e segurança

- CI roda em pull requests e pushes para `develop` e `main`: valida frontend e backend, executa testes do backend, constrói as imagens e publica o agregado `CI OK`.
- Em PRs, Prettier aplica a formatação e gera um patch. Para branches do próprio repositório, um job separado faz commit automático do patch; em forks, a formatação precisa ser aplicada pela pessoa autora.
- Após CI bem-sucedida em `main`, o CD constrói e escaneia as imagens, publica tags SHA/branch/`latest` e, se `DEPLOY_ENABLED=true`, aciona os webhooks dos serviços `core` e `web` no Portainer. Isso redeploya serviços que usam `latest`, mas não atualiza a configuração da stack.
- O auto-merge próprio do Dependabot é limitado a PRs de npm e GitHub Actions direcionados a `develop`, com arquivos permitidos e checks de CI, CodeQL, Dependency Review e Gitleaks aprovados. PRs de Actions também exigem Workflow Security.
- CodeQL e Dependency Review executam com `GHAS_ENABLED=true`. Secret scanning e push protection estão habilitados; a configuração de segurança pode mudar fora do repositório.

Consulte [visão geral da CI/CD](ci_cd/visao-geral.md), [operação](ci_cd/ativacao-e-operacao.md) e [segurança dos workflows](seguranca-workflows/README.md) para detalhes e limitações.

## Índice por área

| Pasta ou documento                                                      | Assunto                                                                 |
| ----------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| [ci_cd/](ci_cd/README.md)                                               | Pipeline, publicação, deploy, operação e diagnóstico                    |
| [dependabot/](dependabot/README.md)                                     | Atualizações de dependências e regras do Dependabot                     |
| [seguranca-workflows/](seguranca-workflows/README.md)                   | Estado atual de CodeQL, Dependency Review, Gitleaks e Workflow Security |
| [implementacao-nova-seguranca/](implementacao-nova-seguranca/README.md) | Registro da implementação original dos controles de segurança           |
| [estrutura/](estrutura/README.md)                                       | CI, Docker, ambientes, testes e versionamento                           |
| [core/](core/README.md)                                                 | Contratos e comportamento da API                                        |
| [interface/](interface/README.md)                                       | Componentes e configuração da interface                                 |
| [contexto/](contexto/CONTEXTO_MODELO.md)                                | Contexto de manutenção, arquitetura e limitações                        |
| [changelog/](changelog/CHANGELOG.md)                                    | Registros históricos de alterações                                      |
| [Comparação de CI/CD](ci_cd/diferencas-ci-cd-main-develop.md)           | Diferenças entre branches e workflows                                   |
| [Migração de servidor](ci_cd/troca-de-servidor/README.md)               | Registro histórico da migração da VM para Swarm                         |
| [Prioridades DevOps](ci_cd/RESUMO_PRIORIDADES_DEVOPS.md)                | Decisões, limitações e itens operacionais pendentes                     |
| [Health check Nginx/Core](ci_cd/nginx-health-check.md)                  | Registro histórico da configuração de health check                      |
| [Remoção de comentários](changelog/REMOCAO_COMENTARIOS.md)              | Registro histórico de limpeza de comentários                            |
