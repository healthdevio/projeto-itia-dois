# Visão geral da CI/CD

Resumo dos workflows versionados em `.github/workflows/ci.yml` e `cd.yml`.

## Fluxo atual

```text
pull request/push em develop ou main -> CI e checks de segurança
PR Dependabot elegível em develop -> validação dos checks -> squash merge
CI concluída com sucesso em main -> CD: build, Trivy e publicação de imagens
DEPLOY_ENABLED=true -> webhooks de redeploy dos serviços core e web no Portainer
```

O CD usa `workflow_run`, faz checkout do mesmo commit aprovado pela CI e só continua quando a conclusão é `success`. O redeploy dos serviços é acionado pelos webhooks quando `DEPLOY_ENABLED=true`; isso não atualiza o arquivo/configuração da stack. Mudanças na stack e rollbacks para tags SHA continuam sendo operações manuais.

## CI

O workflow valida o frontend `apps/chat-omnia`, backend `apps/chat-back`, testes do backend, formatação Prettier e build das imagens. Em PRs, aplica o formato e, quando necessário, um job separado envia o patch à branch do mesmo repositório; PRs de forks precisam aplicar o patch manualmente. CodeQL, Dependency Review, Gitleaks e Workflow Security rodam em workflows separados. A CI usa Node 24; confira os Dockerfiles para as versões atuais de build.

## CD

O CD constrói e escaneia as imagens `chat-core` e `chat-web` com Trivy antes de publicá-las com tags `latest`, branch e SHA. O SHA identifica a versão exata para rollback. As imagens publicadas incluem SBOM e provenance.

Com `DEPLOY_ENABLED=true`, o job de deploy chama os webhooks individuais do Portainer para `core` e `web`, que redeployam serviços configurados com `latest`. Isso não modifica a configuração da stack. Aplique mudanças de stack ou tags SHA no Portainer conforme o procedimento operacional.

## Nomes alinhados

| Papel                 | Caminho/nome                  |
| --------------------- | ----------------------------- |
| Código do backend     | `apps/chat-back`              |
| Dockerfile do backend | `apps/docker/Dockerfile.core` |
| Imagem do backend     | `chat-core`                   |
| Serviço interno       | `core`                        |
| Upstream nginx        | `core:80`                     |
| Banco PostgreSQL      | `omnia`                       |

O workflow e os Dockerfiles foram atualizados; valide a execução da CI e o primeiro deploy em ambiente controlado antes de considerar o fluxo operacional.
