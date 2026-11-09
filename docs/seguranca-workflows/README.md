# Segurança dos workflows

Este documento registra o estado atual dos controles de segurança e CI do repositório. As configurações do GitHub podem mudar fora do código; confirme-as em **Settings → Security and analysis** e **Settings → Secrets and variables → Actions**.

## Estado confirmado em 9 de novembro de 2026

- O repositório está público.
- A variável de Actions `GHAS_ENABLED` está `true`. Ela permite executar os jobs condicionados a essa variável, mas não habilita recursos do GitHub por si só.
- Dependency Graph, Dependabot alerts e Dependabot security updates estão habilitados.
- Secret scanning está habilitado. Push protection e detecção de padrões não associados a provedores estão desabilitados. Push protection pode ser habilitado sem custo para este repositório público em **Settings → Advanced Security → Secret scanning → Push protection**.
- CodeQL foi executado manualmente em `develop` e concluiu com sucesso na execução [42485141471](https://github.com/healthdevio/projeto-itia-dois/actions/runs/42485141471).
- CodeQL e Dependency Review estão executando nos PRs recentes; ambos concluíram com sucesso em PRs de Dependabot em 9 de novembro de 2026.
- Gitleaks passou na varredura dos commits recentes da PR #141. Uma varredura anterior do histórico completo encontrou um segredo antigo. O valor não está reproduzido aqui; confirme sua rotação/revogação e não trate a alteração do workflow como remoção desse segredo do histórico.

## O que cada workflow verifica

### CodeQL

O workflow `.github/workflows/codeql-analysis.yml` analisa JavaScript e TypeScript com as consultas `security-and-quality` e publica os resultados de code scanning no GitHub. É acionado em pushes e PRs direcionados a `develop` ou `main`, além de permitir execução manual. As etapas init, autobuild e analyze usam a mesma versão v4 fixada por SHA. O job é ignorado se `GHAS_ENABLED` não for `true`.

### Dependency Review

O workflow `.github/workflows/dependency-review.yml` compara dependências adicionadas ou atualizadas em um PR com a branch de destino, usando o Dependency Graph e dados de vulnerabilidade do GitHub. É acionado apenas em PRs direcionados a `develop` ou `main`; atualmente falha se uma dependência introduzida tiver severidade `critical`. O job é ignorado se `GHAS_ENABLED` não for `true`.

### Gitleaks

O workflow `.github/workflows/gitleaks.yml` examina as alterações de Git com as regras padrão do Gitleaks. Em PRs e pushes para `develop` ou `main`, verifica os commits introduzidos pelo evento; uma execução manual verifica o commit atual. O escopo incremental evita que um segredo legado bloqueie automaticamente cada alteração, mas não elimina nem resolve exposições históricas.

### Workflow Security

O workflow `.github/workflows/workflow-security.yml` valida que as actions estejam fixadas por SHA e executa actionlint nos arquivos de workflow. É acionado em PRs que alteram `.github/workflows/**`, semanalmente e sob demanda. O auto-merge do Dependabot aguarda `Audit Workflow Security` nos PRs de GitHub Actions e exige CI, CodeQL, Dependency Review e Gitleaks verdes para todos os PRs Dependabot elegíveis.

### Formatação na CI

Em PRs para `develop` ou `main`, o job de formatação executa `npm run format`. Se houver mudanças, ele gera um patch sem permissão de escrita. Um job separado, sem executar npm ou código do PR, aplica o patch e cria um commit na branch de origem. O commit automático é limitado a PRs abertos a partir de branches do próprio repositório; PRs de forks precisam aplicar a formatação manualmente.

## Como validar após alterar as configurações

1. Abra um PR direcionado a `develop` ou `main` para disparar CI, CodeQL, Dependency Review e Gitleaks.
2. Confirme que CI e Gitleaks passaram, CodeQL concluiu e Dependency Review foi executado (não apenas ignorado).
3. Se CodeQL ou Dependency Review falhar, leia o log da execução e confirme que os recursos correspondentes estão disponíveis nas configurações de segurança do repositório.
4. Confirme se o job de formatação terminou e se um commit automático foi enviado quando necessário. Em PRs de forks, aplique as mudanças manualmente.

## Ações de segurança pendentes

- Confirmar que qualquer credencial sinalizada na varredura histórica foi revogada ou rotacionada.
- Avaliar a exposição de arquivos e do histórico Git agora que o repositório é público. Remover um segredo do estado atual não o apaga dos commits antigos.
- Avaliar a ativação de Push protection e da detecção de padrões não associados a provedores em **Settings → Security and analysis**.
- Manter o grupo Dependabot `codeql-action` atualizado para que todas as etapas CodeQL avancem juntas; exigir CI e CodeQL verdes antes do auto-merge de atualizações de workflows.
