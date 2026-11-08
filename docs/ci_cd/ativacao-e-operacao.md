# Ativação e operação do CI/CD

Este guia registra a configuração confirmada e as ações necessárias para operar CI/CD, Dependabot e deploy no Portainer Community Edition.

## Estado confirmado

- O repositório é privado e a organização está no plano gratuito. O ruleset `proteger-main-develop` existe, mas está inativo; hoje o GitHub não aplica a exigência de `CI OK` nem bloqueia pushes diretos.
- **Allow auto-merge** não está disponível. O workflow do Dependabot faz merge direto somente depois de validar o PR e o check `CI OK` no SHA exato.
- A CI verifica frontend, backend, formatação e imagens. `CI OK` agrega esses quatro jobs.
- O workflow Security sempre executa Trivy e `npm audit`. Sem GHAS, Dependency review e CodeQL ficam pulados. Semgrep CE executa como SAST informativo nas primeiras execuções.
- O Portainer é Community Edition 2.45.3 LTS. O deploy usa webhooks individuais dos serviços `core` e `web`; não usa webhook de stack.
- A stack versionada está em `apps/docker/pw2c/docker-stack.yml`. Ela deve consumir `registry.cloud.grupopw2c.com.br/chat-core:latest` e `registry.cloud.grupopw2c.com.br/chat-web:latest`.

## Configuração manual no GitHub

### Variáveis de Actions

Abra **Settings → Secrets and variables → Actions → Variables** e configure estas repository variables:

| Nome                | Valor                                          | Efeito                                                                                                                |
| ------------------- | ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `AUTOMERGE_ENABLED` | `true`                                         | Habilita a tentativa de merge direto para PRs Dependabot elegíveis. Deixe ausente ou diferente de `true` para pausar. |
| `DEPLOY_ENABLED`    | `true`                                         | Habilita o job de deploy depois da publicação bem-sucedida em `main`.                                                 |
| `GHAS_ENABLED`      | `true` somente após upgrade/licença compatível | Habilita Dependency review e CodeQL. No plano atual, mantenha ausente ou diferente de `true`.                         |

São repository variables porque as condições dos jobs as consultam antes da execução. `GHAS_ENABLED` é opcional; os outros dois também funcionam como interruptores.

### Secrets e environment

Confirme os secrets de registry em **Settings → Secrets and variables → Actions → Secrets**:

- `PW2C_REGISTRY_USERNAME`
- `PW2C_REGISTRY_PASSWORD`

Em **Settings → Environments → production → Environment secrets**, cadastre os links de serviço do Portainer:

- `PORTAINER_WEBHOOK_CORE`
- `PORTAINER_WEBHOOK_WEB`

O job de deploy usa `environment: production`. Os links de webhook são credenciais de acionamento e não devem ser colocados em arquivos do repositório.

Em **Settings → General → Pull Requests**, confirme que **Allow squash merging** está habilitado. O workflow usa `gh pr merge --squash` e não depende de auto-merge nativo.

## Configuração manual no Portainer

1. Abra **Stacks → projeto-itia-2** e confira a imagem do serviço `core`. A configuração versionada usa `OMNIA_CORE_IMAGE` com padrão `registry.cloud.grupopw2c.com.br/chat-core:latest`.
2. Se o `.Env` da stack ainda definir `OMNIA_BACKEND_IMAGE` ou outra tag de backend, remova essa variável antiga e use `OMNIA_CORE_IMAGE=registry.cloud.grupopw2c.com.br/chat-core:latest` (ou remova a variável para usar o padrão do compose).
3. Confirme que o serviço `web` usa `registry.cloud.grupopw2c.com.br/chat-web:latest`.
4. Atualize a configuração da stack para o serviço `web` receber tráfego na porta interna `8080`. A imagem web roda como não-root e o Nginx escuta nessa porta; a porta publicada externa pode continuar igual.
5. Em **Services → core → Service webhook** e **Services → web → Service webhook**, habilite e copie os dois links. O webhook de serviço redeploya o serviço com a tag já configurada; ele não aplica alterações novas no Compose da stack.
6. Armazene os links como os dois Environment secrets `PORTAINER_WEBHOOK_CORE` e `PORTAINER_WEBHOOK_WEB` em `production`.

O banco não recebe webhook: o CD não constrói nem publica imagem do banco. Com `:latest`, cada webhook puxa a imagem recém-publicada e reinicia o serviço. Se a stack usa tags SHA, atualize as tags na stack antes do redeploy.

## Como funciona o auto-merge do Dependabot

O workflow não faz checkout e não executa arquivos do PR. Após uma execução concluída da CI em um evento `pull_request`, ele consulta GitHub via API e só prossegue quando:

- `AUTOMERGE_ENABLED` é `true`;
- a execução foi bem-sucedida, é de um PR e foi iniciada pelo Dependabot;
- há PR associado, criado pelo Dependabot, não draft, direcionado a `develop`, sem conflito e ainda no mesmo `head SHA` que a CI verificou;
- a branch contém `development-minor-patch` ou `actions-minor-patch`;
- os arquivos alterados são apenas manifests/lockfiles permitidos para o grupo ou arquivos em `.github/workflows/**` para o grupo de Actions;
- o check `CI OK` mais recente para aquele `head SHA` está concluído com sucesso.

O Dependabot está configurado para abrir PRs npm e GitHub Actions para `develop`, que é o destino observado pela automação. O workflow nunca faz merge de PR para `main`, grupos de produção, Docker ou atualizações major. Qualquer arquivo fora da lista permitida cancela a tentativa de merge.

Para ativar essa automação, crie a repository variable `AUTOMERGE_ENABLED=true`. O ruleset continua inativo, então o GitHub não impõe os checks entre a validação da automação e o merge direto.

O merge usa `GITHUB_TOKEN`. O GitHub não inicia workflows de `push` disparados por eventos criados com esse token. Portanto, a CI não rodará novamente em `develop` depois do merge. Isso é aceitável para este desenho porque o workflow valida explicitamente `CI OK` no `head SHA` antes do merge. A CI de um PR posterior de `develop` para `main` também roda normalmente.

Se for necessário disparar CI pós-merge em `develop`, a alternativa é autenticar a operação de merge com um GitHub App token ou PAT fine-grained. Essa mudança exige criar a credencial com permissões de pull request/contents, armazená-la como secret e substituir o token do passo de merge; ela não está implementada.

## Checks: informativos e bloqueio por convenção

Como o ruleset está inativo, **nenhum check impede tecnicamente o merge**. Checks vermelhos devem ser tratados como bloqueio por convenção pela equipe até que o enforcement esteja disponível.

| Check/job                                    | Resultado esperado              | Papel                                                                                                                |
| -------------------------------------------- | ------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| CI `frontend`, `backend`, `format`, `images` | Verde                           | Alimentam o agregado `CI OK`.                                                                                        |
| CI `CI OK`                                   | Verde                           | Check agregado principal; não é imposto enquanto o ruleset estiver inativo.                                          |
| Security `Trivy filesystem scan`             | Verde                           | Bloqueante por convenção para HIGH/CRITICAL em CVEs, segredos e misconfiguração.                                     |
| Security `npm audit`                         | Verde                           | Bloqueante por convenção para advisories npm HIGH/CRITICAL em cada lockfile. Complementa o Trivy com o audit de npm. |
| Security `Semgrep CE SAST`                   | Pode reportar achados           | Informativo durante a implantação inicial (`continue-on-error: true`); não deve bloquear merge.                      |
| Security `Dependency review`                 | Pulado no plano atual           | Só executa quando `GHAS_ENABLED=true` e Dependency Graph/GHAS estiver disponível.                                    |
| Security `CodeQL`                            | Executa em PR/push              | Requer `actions: read`, `security-events: write` e code scanning disponível para o repositório.                      |
| Dependabot Auto-merge                        | Normalmente pulado em PR humano | Só executa no evento CI de PR Dependabot elegível para `develop`.                                                    |
| CD `Deploy Portainer stack`                  | Pulado até habilitar            | Executa depois da publicação se `DEPLOY_ENABLED=true`.                                                               |

## Imagens e Dockerfiles

- `apps/docker/Dockerfile.core` existe e constrói o backend de `apps/chat-back`.
- `apps/docker/Dockerfile.back` não existe no repositório.
- A stack Swarm versionada consome `chat-core`, então CI e CD constroem/escaneiam `Dockerfile.core` e publicam o resultado como `chat-core`.
- A imagem web é construída por `apps/docker/Dockerfile.web` e publicada como `chat-web`.

O nome da imagem backend foi alinhado explicitamente de `chat-back` para `chat-core`, para corresponder à stack Portainer informada. Antes de ativar o deploy, confirme que o serviço `core` implantado também usa `chat-core`; a publicação antiga `chat-back` não atualiza automaticamente esse serviço.

## Proteção detectiva de pushes diretos (proposta, não implementada)

Uma opção é um workflow em `push` para `main`/`develop` que consulte a API de PRs associados ao SHA. Se não encontrar PR, ele pode gravar aviso no summary e abrir uma issue com SHA, branch e autor.

Isso não bloqueia o push; apenas cria trilha de auditoria enquanto o ruleset não é aplicado. Vale a pena se pushes diretos forem exceção. Para reduzir ruído, deduplicar a issue por SHA e deixar pushes diretos intencionais registrados como exceções. A implementação foi deixada para depois.

## Alternativa agendada para Dependabot (opcional, não implementada)

Um workflow semanal poderia procurar PRs Dependabot elegíveis que já tenham CI verde e mesclá-los em lote. Não é necessário no fluxo atual, pois a conclusão da CI de cada PR já dispara a validação e tentativa de merge. O agendamento adicionaria API polling e logs sem benefício enquanto os eventos `workflow_run` estiverem chegando normalmente.
