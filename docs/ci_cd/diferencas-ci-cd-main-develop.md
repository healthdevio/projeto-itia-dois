# Diferenças de CI e CD entre `main` e `develop`

Comparação dos workflows versionados nas referências remotas verificadas em
**28 de outubro de 2026**:

| Branch    | Commit consultado                   |
| --------- | ----------------------------------- |
| `main`    | `fbc05e9` — `chore: atualizando CD` |
| `develop` | `e470179` — merge do PR #64         |

## CI

As duas branches usam `.github/workflows/ci.yml`. O workflow é disparado em
pushes e pull requests para `develop` e `main`, e executa os jobs de frontend,
backend, formatação e imagens Docker.

| Item                                      | `main`                                         | `develop`                                                              |
| ----------------------------------------- | ---------------------------------------------- | ---------------------------------------------------------------------- |
| Permissões globais                        | `contents: read`                               | `contents: read` e `id-token: write`                                   |
| Permissões do job Backend                 | Herda as permissões globais                    | Declara `contents: read` e `id-token: write` no próprio job            |
| Action do Trivy                           | `aquasecurity/trivy-action@0.36.0`             | SHA `ed142fd0673e97e23eac54620cfb913e5ce36c25`, anotado como `v0.36.0` |
| Comentário no passo de build da interface | Explica por que `dist` não pode ser versionado | Comentário removido; sem mudança no comando executado                  |

### O que isso muda

- `develop` concede permissão para solicitar tokens OIDC. O job Backend repete
  essa permissão explicitamente. O workflow atual não tem um passo separado de
  login OIDC; confira se essa permissão ainda é necessária antes de ampliá-la a
  outros jobs.
- A referência do Trivy em `main` não foi resolvida pelo runner durante a falha
  observada. `develop` fixa a action em um SHA completo, evitando depender da
  resolução de uma tag.
- Fora esses pontos e a remoção de um comentário, os jobs da CI são equivalentes.

O número `0.70.0` visto no log era a versão do **binário Trivy** que a action
executou; não era a versão da action `aquasecurity/trivy-action`.

## CD

`.github/workflows/cd.yml` é idêntico em `main` e `develop` nos commits
comparados. Ele começa após a conclusão do workflow de CI, mas o job publica
somente se a execução tiver sucesso e pertencer à branch `main`. Portanto, a
presença do arquivo em `develop` não publica imagens a partir de `develop`.

Quando acionado em `main`, o CD:

1. Faz checkout do SHA aprovado pela CI.
2. Autentica no registry privado `registry.cloud.grupopw2c.com.br` usando os
   secrets `PW2C_REGISTRY_USERNAME` e `PW2C_REGISTRY_PASSWORD`.
3. Constrói e publica backend e interface para `linux/amd64`, com SBOM e
   provenance.
4. Publica tags `latest`, o SHA e o nome da branch.
5. Deixa a atualização da stack do Portainer manual.

### Inconsistência compartilhada pelo CD

Em ambas as branches, o CD aponta o build do backend para
`apps/docker/Dockerfile.back`. Esse arquivo não existe em `main` nem em
`develop`; os Dockerfiles presentes são `apps/docker/Dockerfile.core` e
`apps/docker/Dockerfile.web`. Assim, apesar de `cd.yml` não diferir entre as
branches, a publicação do backend precisa ter esse caminho corrigido antes de
confiar na execução do CD.

## Conferir novamente

Atualize as referências antes de comparar, pois elas mudam com novos merges:

```bash
git fetch itia main develop
git diff itia/main..itia/develop -- .github/workflows/ci.yml .github/workflows/cd.yml
```

Links diretos: [`ci.yml`](../../.github/workflows/ci.yml) e
[`cd.yml`](../../.github/workflows/cd.yml).
