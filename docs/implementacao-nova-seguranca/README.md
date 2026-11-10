# Segurança e validação dos workflows

> Registro da implementação original. Para o estado atual do repositório, disponibilidade dos recursos e últimas execuções, consulte [seguranca-workflows](../seguranca-workflows/README.md).

> Estado atual: o repositório é público, `GHAS_ENABLED=true`, e CodeQL/Dependency Review executam sem assinatura paga neste repositório.
>
> Este arquivo registra decisões e procedimentos da implementação original. Para comportamentos atuais de CI, deploy, push protection e auto-merge, use [Ativação e operação](../ci_cd/ativacao-e-operacao.md) e [Segurança dos workflows](../seguranca-workflows/README.md).

## Objetivo

Este documento descreve as correções dos workflows em `.github/workflows/` e os requisitos para executá-los. A documentação corresponde aos arquivos desta cópia de trabalho; não significa que as mudanças já foram publicadas no GitHub.

## Correções realizadas

### Gitleaks — `gitleaks.yml`

- Substituída a referência inexistente `gitleaks/gitleaks@...` por execução da imagem oficial do CLI Gitleaks, fixada por digest.
- À época da implementação, o repositório era privado e pertencia a uma organização. A action `gitleaks/gitleaks-action` exigia `GITLEAKS_LICENSE` para organizações; o CLI evita essa dependência.
- Em PRs e pushes, `gitleaks git` analisa somente os commits introduzidos naquele evento; uma execução manual analisa o commit atual. O checkout completo disponibiliza os SHAs usados para delimitar o intervalo.
- A execução do PR #141 encontrou um segredo em commits anteriores ao intervalo desse PR. O log não expôs o valor. Essa detecção histórica não é descartada como falso positivo: se a credencial ainda puder ser usada, ela deve ser revogada e rotacionada; qualquer limpeza do histórico precisa ser coordenada separadamente.
- Removidos `config: /dev/null` e `args` passados como inputs de action. A action anterior não tinha esses inputs e `/dev/null` também impediria o uso das regras padrão.
- Removidos o comentário de sucesso enganoso no PR e as permissões de escrita. O scanner não precisa de token do GitHub; findings fazem o job falhar e os valores são redigidos na saída.

O workflow usa a imagem `zricethezav/gitleaks` na versão 8.30.1, com digest para Linux/amd64. Atualizações de imagem devem atualizar e validar o digest junto com a versão.

### CodeQL — `codeql-analysis.yml`

- Separadas as etapas `init`, `autobuild` e `analyze`, todas agora apontando para a release v4.39.1, fixada pelo mesmo SHA.
- A linguagem passou a ser `javascript-typescript`, que cobre JavaScript e TypeScript em uma análise CodeQL.
- Corrigido `pack_list` para `queries: security-and-quality`.
- Removido o upload de `/.codeql`: esse caminho não era produzido pelo workflow. O próprio CodeQL publica os resultados na área de code scanning.
- Desativadas as credenciais persistentes do checkout.
- Incluída `actions: read` nas permissões do job. Como o job declara permissões próprias, ele não herdava essa permissão do nível do workflow, necessária para consultar a execução via API.
- O job só executa quando a variável de repositório `GHAS_ENABLED` é `true`. Para o repositório público, CodeQL pode publicar alertas sem licença paga de GitHub Code Security.

Para repositórios privados, a disponibilidade e cobrança do code scanning dependem do plano/licença da organização.

### Dependency Review — `dependency-review.yml`

- Mantido somente o gatilho `pull_request`, evitando duas execuções para o mesmo PR.
- Removido o checkout, que não é necessário para comparar as dependências do PR.
- Atualizada a action para v5, fixada por SHA.
- Incluída `pull-requests: read` nas permissões do job; permissões no nível do job substituem as do workflow.
- Removido `category`, que não é um input suportado pela action.
- O job só executa quando a variável de repositório `GHAS_ENABLED` é `true`; o Dependency Graph precisa estar habilitado.

A política continua bloqueando dependências com severidade `critical`. O Dependency Graph do GitHub deve estar habilitado para o repositório.

### CI — `ci.yml`

- O job de imagens Docker não depende mais do job de formatação, que só é executado em pull requests. Assim, imagens também são construídas nos pushes.
- O check `CI OK` agora exige sucesso do frontend, backend e imagens. Em pull requests, exige também sucesso da formatação; em pushes, o job de formatação pode ser ignorado.
- Fixada por SHA a action `docker/setup-buildx-action`, que ainda usava uma tag mutável.
- A formatação em PR usa `npm run format:check` com permissão somente de leitura. Se houver arquivos fora do padrão, o job falha; a pessoa autora deve executar `npm run format` localmente e enviar as correções em um novo commit.
- Removido o auto-commit que executava `npm run format`, usava `git add -A` e fazia push com `[skip ci]`. Esse comportamento dava permissão de escrita ao workflow e podia alterar arquivos fora do PR sem validar novamente o commit formatado.

### Auditoria — `workflow-security.yml`

- A verificação de actions agora exige referências no formato SHA completo de 40 caracteres hexadecimais; referências sem pin fazem o job falhar.
- O actionlint é executado com versão definida e falha o job quando encontra erros. Removido o fallback que transformava ausência do binário ou erro de lint em sucesso.
- Fixada por SHA a action usada para executar o actionlint.
- A lista de permissões continua sendo informativa: o workflow a imprime, mas não determina automaticamente se cada permissão é excessiva. Essa avaliação ainda requer revisão.

## Validação realizada

- **actionlint 1.7.12:** passou na validação anterior dos workflows. As alterações atuais foram verificadas com Prettier; a validação actionlint delas ocorrerá no workflow `Workflow Security` após publicação.
- **Referências:** os SHAs das actions alteradas foram conferidos com as tags correspondentes no GitHub; o digest da imagem Gitleaks foi conferido para Linux/amd64.
- **Gitleaks:** o scanner não foi executado localmente porque o daemon Docker não estava disponível. A execução real ocorrerá no runner Ubuntu do GitHub Actions.
- **Execução no GitHub:** ainda precisa ser confirmada após publicar as mudanças; os arquivos desta cópia de trabalho não foram commitados por esta tarefa.

## Operação e acompanhamento

1. Após publicar, conferir os checks de Gitleaks, CodeQL, Dependency Review, CI e Workflow Security em um PR e em um push para `develop`. CodeQL e Dependency Review ficam ignorados enquanto `GHAS_ENABLED` não for `true`.
2. Se Gitleaks encontrar um segredo, não copie seu valor para issues, comentários ou documentação. Revogue e rotacione a credencial exposta e trate o histórico de acordo com o processo do projeto.
3. Confirmar no GitHub se Code Scanning e Dependency Graph estão habilitados. Para repositórios privados, a disponibilidade depende do plano/licença; neste repositório público, os dois recursos estão em uso.
4. Atualizar os SHAs das actions e o digest da imagem deliberadamente, registrando a versão upstream correspondente.

## Limite da análise local

O arquivo `.github/workflows/workflow-lint.yml` não estava presente nesta cópia de trabalho. Portanto, a falha histórica desse workflow não pôde ser reproduzida nem corrigida aqui. O workflow `workflow-security.yml` passa a validar os arquivos presentes com actionlint e pode ser usado para substituir ou complementar esse lint quando a configuração legada estiver disponível.
