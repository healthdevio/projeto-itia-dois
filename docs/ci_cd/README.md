# CI/CD

Índice da documentação de integração, publicação e operação do Chat Omnia.

## Estado atual

Os nomes de backend, serviço e imagem estão alinhados nos arquivos versionados. O CD é acionado depois de uma CI bem-sucedida em `main`: constrói, escaneia e publica as imagens. Com `DEPLOY_ENABLED=true`, também aciona os webhooks dos serviços `core` e `web` no Portainer. Isso redeploya os serviços configurados, mas não atualiza o conteúdo/configuração da stack.

Como os componentes se conectam:

- `Dockerfile.core` compila `apps/chat-back`; o serviço Swarm e o upstream nginx usam `core`.
- O CD publica `chat-core`, nome configurado na stack.
- Em PRs do próprio repositório, a CI executa `npm run format` e envia um commit automático quando encontra diferenças. O job que aplica o formato não tem permissão de escrita; um job separado, sem executar npm, aplica o patch e envia o commit.
- PRs abertos a partir de forks não recebem commits automáticos por segurança. Se a formatação mudar arquivos nesse caso, o check informa que a pessoa autora precisa aplicar as alterações.
- O Postgres tem health check; a inicialização do backend também aguarda conexão antes das migrations.
- Os workflows de CodeQL, Dependency Review, Gitleaks e Workflow Security estão ativos; o auto-merge do Dependabot só considera PRs elegíveis para `develop` depois dos checks exigidos.

## Documentos

| Documento                                           | Conteúdo                                                       |
| --------------------------------------------------- | -------------------------------------------------------------- |
| [Visão geral](visao-geral.md)                       | Gatilhos e etapas atuais dos workflows                         |
| [Decisões](decisoes.md)                             | Justificativas históricas da configuração de deploy            |
| [Pré-requisitos](pre-requisitos.md)                 | Configuração do cluster e credenciais                          |
| [Publicação](publicacao.md)                         | Build e publicação de imagens                                  |
| [Deploy](deploy.md)                                 | Modelo de stack previsto                                       |
| [Operação](operacao.md)                             | Verificação e diagnóstico; confira os nomes reais dos serviços |
| [Problemas](problemas/README.md)                    | Diagnóstico por sintomas                                       |
| [Migração de servidor](troca-de-servidor/README.md) | Registro histórico da migração da VM Oracle para Swarm         |

## Fluxo configurado

```text
PR/push para develop ou main -> CI e checks de segurança
PR Dependabot elegível para develop -> validação dos checks -> squash merge automático
CI concluída com sucesso em main -> CD: build, Trivy, publicação das imagens
DEPLOY_ENABLED=true -> webhooks do Portainer para redeploy dos serviços core e web
```

O CD usa `workflow_run` e publica o SHA aprovado pela CI. Os webhooks redeployam serviços que usam `latest`; mudanças no arquivo da stack e rollback para tags SHA continuam exigindo atualização operacional no Portainer. Confira [ativação e operação](ativacao-e-operacao.md) para as condições do auto-merge e as variáveis necessárias.
