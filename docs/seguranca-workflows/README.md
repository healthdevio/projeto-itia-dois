# Segurança dos workflows

Este documento registra o estado atual dos controles de segurança e CI do repositório. As configurações do GitHub podem mudar fora do código; confirme-as em **Settings → Security and analysis** e **Settings → Secrets and variables → Actions**.

## Estado confirmado em 8 de novembro de 2026

- O repositório está público.
- A variável de Actions `GHAS_ENABLED` está `true`. Ela permite executar os jobs condicionados a essa variável, mas não habilita recursos do GitHub por si só.
- Dependency Graph, Dependabot alerts e Dependabot security updates estão habilitados.
- Secret scanning está habilitado. Push protection e detecção de padrões não associados a provedores estão desabilitados.
- CodeQL foi executado manualmente em `develop` e concluiu com sucesso na execução [42485141471](https://github.com/healthdevio/projeto-itia-dois/actions/runs/42485141471).
- Ainda não foi confirmada uma execução bem-sucedida de Dependency Review depois de tornar o repositório público e definir `GHAS_ENABLED=true`. O job deve ser confirmado em um PR novo.
- Gitleaks passou na varredura dos commits recentes da PR #141. Uma varredura anterior do histórico completo encontrou um segredo antigo. O valor não está reproduzido aqui; confirme sua rotação/revogação e não trate a alteração do workflow como remoção desse segredo do histórico.

## O que cada workflow verifica

### CodeQL

O workflow `.github/workflows/codeql-analysis.yml` analisa JavaScript e TypeScript com as consultas `security-and-quality` e publica os resultados de code scanning no GitHub. É acionado em pushes e PRs direcionados a `develop` ou `main`, além de permitir execução manual. O job é ignorado se `GHAS_ENABLED` não for `true`.

### Dependency Review

O workflow `.github/workflows/dependency-review.yml` compara dependências adicionadas ou atualizadas em um PR com a branch de destino, usando o Dependency Graph e dados de vulnerabilidade do GitHub. É acionado apenas em PRs direcionados a `develop` ou `main`; atualmente falha se uma dependência introduzida tiver severidade `critical`. O job é ignorado se `GHAS_ENABLED` não for `true`.

### Gitleaks

O workflow `.github/workflows/gitleaks.yml` examina as alterações de Git com as regras padrão do Gitleaks. Em PRs e pushes para `develop` ou `main`, verifica os commits introduzidos pelo evento; uma execução manual verifica o commit atual. O escopo incremental evita que um segredo legado bloqueie automaticamente cada alteração, mas não elimina nem resolve exposições históricas.

### Formatação na CI

O workflow de CI executa `npm run format:check` em PRs para `develop` ou `main`. Esse comando verifica a formatação sem modificar os arquivos. A CI não executa `npm run format` nem faz auto-commit; caso a verificação falhe, corrija a formatação localmente e envie outro commit.

## Como validar após alterar as configurações

1. Abra um PR direcionado a `develop` ou `main` para disparar CI, CodeQL, Dependency Review e Gitleaks.
2. Confirme que CI e Gitleaks passaram, CodeQL concluiu e Dependency Review foi executado (não apenas ignorado).
3. Se CodeQL ou Dependency Review falhar, leia o log da execução e confirme que os recursos correspondentes estão disponíveis nas configurações de segurança do repositório.
4. Não execute `npm run format` como substituto do teste da CI. A verificação automatizada é somente leitura e deve validar o commit do PR.

## Ações de segurança pendentes

- Confirmar que qualquer credencial sinalizada na varredura histórica foi revogada ou rotacionada.
- Avaliar a exposição de arquivos e do histórico Git agora que o repositório é público. Remover um segredo do estado atual não o apaga dos commits antigos.
- Avaliar a ativação de Push protection e da detecção de padrões não associados a provedores em **Settings → Security and analysis**.
- Atualizar CodeQL Action v3 para v4 antes da descontinuação anunciada para dezembro de 2026; validar os SHAs das actions e o workflow antes de mudar a versão.
