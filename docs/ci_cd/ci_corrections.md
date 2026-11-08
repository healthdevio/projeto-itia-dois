# Correções no CI — `ci.yml`

> **Registro histórico:** este documento descreve a proposta antiga de auto-commit do Prettier. A configuração atual usa `npm run format:check` e não altera nem envia commits automaticamente; consulte `.github/workflows/ci.yml` e `../implementacao-nova-seguranca/README.md`.

## Resumo

Foram identificados e corrigidos dois problemas no workflow de CI que impediam o funcionamento correto das etapas de build Docker e formatação automática.

---

## 1. Correção crítica — `docker/build-push-action` com hash inválido

### Problema

O job `Imagens Docker` usava o mesmo hash do `docker/setup-buildx-action` para o `docker/build-push-action`. Como são actions diferentes, o hash não existia nessa action e o GitHub não conseguia resolver o repositório.

**Erro exibido no CI:**

```
Unable to resolve action `docker/build-push-action@b5ca514318bd6ebac0fb2aedd5d36ec1b5c232a2`, repository or version not found
```

### Causa

```yaml
# ANTES — hash incorreto (pertence ao setup-buildx-action)
- uses: docker/build-push-action@b5ca514318bd6ebac0fb2aedd5d36ec1b5c232a2 # v3.10.0
```

### Correção

```yaml
# DEPOIS — hash correto da build-push-action v6.18.0
- uses: docker/build-push-action@263435318d21b8e681c14492fe198d362a7d2c83 # v6.18.0
```

---

## 2. Correção do job de formatação — Prettier não commitava automaticamente

### Problema

O job `Formatação (Prettier)` estava configurado sem permissão de escrita e sem credenciais persistidas, o que impedia o `git push` das correções automáticas de volta na branch do PR.

### Causas identificadas

| Configuração           | Antes (quebrado)         | Depois (correto)         | Motivo                                                     |
| ---------------------- | ------------------------ | ------------------------ | ---------------------------------------------------------- |
| `persist-credentials`  | `false`                  | `true`                   | Necessário para autenticar o `git push`                    |
| `permissions.contents` | `read`                   | `write`                  | Sem `write` o push é bloqueado pelo GitHub                 |
| `ref`                  | ausente                  | `${{ github.head_ref }}` | Garante checkout na branch do PR, não no merge commit      |
| `git add -A`           | ausente                  | presente                 | Sem `add` os arquivos modificados não entram no commit     |
| `if`                   | `pull_request \|\| push` | apenas `pull_request`    | O auto-commit só faz sentido em PRs, não em pushes diretos |

### Antes

```yaml
format:
  permissions:
    contents: read          # ❌ sem permissão de escrita
  steps:
    - uses: actions/checkout@...
      with:
        persist-credentials: false   # ❌ sem credenciais = push falha
                                     # ❌ sem ref = checkout no merge commit errado
    - name: Commit das correções
      run: |
        git config ...
        if [ -n "$(git diff --stat)" ]; then
          git commit -m "style: auto-format by Prettier [skip ci]"
          # ❌ sem git add — arquivos não são staged
          git push  # ❌ falha por falta de credenciais e permissão
        fi
```

### Depois

```yaml
format:
  if: github.event_name == 'pull_request'   # ✅ só roda em PRs
  permissions:
    contents: write         # ✅ permite git push
  steps:
    - uses: actions/checkout@...
      with:
        persist-credentials: true            # ✅ credenciais disponíveis para push
        ref: ${{ github.head_ref }}          # ✅ checkout correto na branch do PR
    - name: Commit das correções
      run: |
        git config ...
        if [ -n "$(git diff --stat)" ]; then
          git add -A                         # ✅ stages todos os arquivos alterados
          git commit -m "style: auto-format by Prettier [skip ci]"
          git push                           # ✅ funciona com as credenciais corretas
        fi
```

---

## Comportamento esperado após as correções

- ✅ As imagens Docker são construídas corretamente nos jobs de CI
- ✅ O Prettier aplica as correções de formatação automaticamente em PRs
- ✅ Um commit com a mensagem `style: auto-format by Prettier [skip ci]` é criado na branch do PR quando há arquivos fora do padrão
- ✅ O `[skip ci]` evita que o commit de formatação dispare um novo CI desnecessariamente
- ✅ Quando não há nada para formatar, nenhum commit é criado
