# Ativação e operação do CI/CD

Este guia registra o estado atual dos workflows e os passos para concluir a configuração no GitHub e no Portainer.

## Estado atual

- Os workflows estão em `.github/workflows`: CI, CD, Security, Workflow Lint e Dependabot Auto-merge.
- O check final obrigatório da CI se chama **CI OK**. Ele depende de `frontend`, `backend`, `format` e `images`.
- A publicação do CD ocorre depois de uma CI concluída com sucesso em `main`. Ela publica `chat-back` e `chat-web` com as tags `latest`, SHA do commit e branch, além de SBOM e provenance.
- O deploy é opcional e chama dois webhooks individuais do Portainer: core e web. O banco não é redeployado.
- Os secrets `PORTAINER_CORE_WEBHOOK_URL` e `PORTAINER_WEB_WEBHOOK_URL` já foram adicionados ao environment `production`, conforme informado pelo responsável pelo repositório.
- O Trivy encontrou dependências vulneráveis no lockfile do frontend e Dockerfiles sem usuário não-root. O lockfile foi atualizado e os Dockerfiles foram ajustados; a próxima execução do CI deve confirmar que os alertas foram resolvidos.
- A imagem web agora escuta na porta interna `8080` para poder executar como usuário não-root. O arquivo `apps/docker/pw2c/docker-stack.yml` já usa `target: 8080`.

## Checklist para concluir a configuração

### 1. Conferir configuração da stack no Portainer

Antes de habilitar o deploy automático:

1. Abra a stack e confirme que os serviços `core` e `web` usam as imagens publicadas pelo CD.
2. Confirme que ambos usam `:latest`, ou atualize a tag manualmente antes do redeploy. O CD também publica tags de SHA e branch, mas os webhooks de serviço reutilizam a tag configurada no serviço.
3. Atualize o serviço web para escutar na porta interna `8080`. Mantenha a porta publicada que seus usuários já acessam, se ela continuar adequada. A mudança no arquivo Compose do repositório não altera automaticamente uma stack gerenciada manualmente no Portainer.
4. Confirme que os webhooks individuais do core e do web estão ativos. O serviço do banco não precisa de webhook para uma publicação que altera somente core e web.

O endpoint dos webhooks precisa estar acessível pelo runner hospedado do GitHub Actions. Trate cada URL como segredo: quem tiver o link pode acionar o redeploy.

### 2. Conferir secrets do repositório e do environment

Em **Settings → Secrets and variables → Actions → Secrets**, confirme que existem:

- `PW2C_REGISTRY_USERNAME`
- `PW2C_REGISTRY_PASSWORD`

Em **Settings → Environments → production → Environment secrets**, confirme:

- `PORTAINER_CORE_WEBHOOK_URL`
- `PORTAINER_WEB_WEBHOOK_URL`

O job `deploy` declara `environment: production`, então os dois webhooks precisam estar como secrets desse environment.

### 3. Executar a CI e cadastrar `CI OK` como check

1. Faça merge das alterações dos workflows na branch `main` seguindo o fluxo normal do repositório.
2. Abra **Actions → CI (Continuous Integration)** e aguarde a execução em `main` terminar.
3. Confirme que o job **CI OK** terminou com sucesso. Se falhar, corrija o job apontado antes de torná-lo obrigatório.
4. Abra **Settings → Branches** (ou a regra equivalente em **Rules → Rulesets**) e edite as regras para `main` e `develop`.
5. Habilite a exigência de checks e selecione somente **CI OK** como check obrigatório desta CI.

O GitHub só lista um check depois que ele já foi publicado por uma execução recente. Os três jobs pulados na execução anterior não impedem `CI OK` de aparecer:

- **CodeQL** e **Dependency review** são condicionados a `GHAS_ENABLED=true`.
- **Automerge** só executa para PR criado pelo Dependabot, direcionado a `develop` e pertencente ao mesmo repositório.

### 4. Habilitar ou deixar desligado o deploy automático

Depois de verificar as portas, tags, secrets do registry e webhooks, abra **Settings → Secrets and variables → Actions → Variables** e crie a variável **do repositório**:

| Nome             | Valor  |
| ---------------- | ------ |
| `DEPLOY_ENABLED` | `true` |

Use uma repository variable: a condição do job de deploy consulta `vars.DEPLOY_ENABLED` no nível do job. Se a variável não existir ou não for `true`, o deploy fica _skipped_ e o CD apenas publica as imagens.

Quando o deploy estiver habilitado, um novo CI bem-sucedido em `main` dispara o CD. Ativar a variável depois de uma execução não dispara retroativamente o CD; será necessária uma nova mudança em `main` que rode a CI.

O job chama os webhooks de core e web em sequência. Se o primeiro falhar, o step para e não chama o segundo; consulte o log do job `Deploy Portainer stack` para ver o resultado.

### 5. Dependabot Auto-merge (opcional)

O job **Automerge** só tenta habilitar merge automático para os grupos `development-minor-patch` e `actions-minor-patch`. Ele não inclui atualizações de produção, Docker ou major.

Para usá-lo:

1. Primeiro faça `CI OK` aparecer e exija esse check na proteção da branch `develop`.
2. Em **Settings → General → Pull Requests**, habilite **Allow auto-merge**, se a opção estiver disponível para o repositório e plano do GitHub.
3. Em `.github/dependabot.yml`, descomente `target-branch: develop` na configuração npm se a intenção for receber esses PRs em `develop`.
4. Para auto-merge de atualizações de GitHub Actions em `develop`, configure também o destino `develop` para esse ecossistema. A configuração atual mantém esse destino comentado/ausente.

Se **Allow auto-merge** não estiver disponível, mantenha os PRs do Dependabot em merge manual. O workflow não pode habilitar essa opção global do repositório por conta própria.

### 6. CodeQL e Dependency review (opcionais)

Em **Settings → Secrets and variables → Actions → Variables**, crie `GHAS_ENABLED=true` somente se GitHub Advanced Security/Code Security estiver habilitado e disponível para este repositório privado. Essa variável libera os jobs CodeQL e Dependency review. Sem ela, esses dois jobs aparecem como _skipped_ por desenho; o job Trivy filesystem continua rodando.

## O que verificar em cada execução

1. **CI (Continuous Integration):** `frontend`, `backend`, `format`, `images` e `CI OK` devem concluir com sucesso.
2. **Security:** Trivy deve concluir sem achados HIGH/CRITICAL que bloqueiem a execução. A execução após a atualização do lockfile e dos Dockerfiles é a confirmação definitiva.
3. **CD (Continuous Delivery), em `main`:** confirme build, scan Trivy e publicação de `chat-back` e `chat-web`.
4. **Deploy Portainer:** se habilitado, confirme no summary que os webhooks foram chamados e verifique os serviços no Portainer.
5. **Workflow Lint:** confirme que `actionlint` e `zizmor` passam após as correções do instalador, da condição Dependabot e da justificativa para o trigger `workflow_run`.

## Observações sobre os skips

Um job `skipped` não significa falha automaticamente. Os skips esperados são CodeQL/Dependency review quando `GHAS_ENABLED` não é `true`, Automerge em PR que não é do Dependabot para `develop`, e Deploy quando `DEPLOY_ENABLED` não é `true` ou quando a publicação anterior não foi concluída com sucesso.
