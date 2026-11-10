# Remoção de comentários dos arquivos de infraestrutura

Data: 2026-10-19
Commit: `5846d80` — `refactor(cd): tira os comentarios dos arquivos e leva a senha para o .Env`

---

## Por que remover

Os arquivos de infraestrutura (Dockerfile, workflow, stack, entrypoint) acumulavam comentários que explicavam **decisões** — não o que o código faz. Comentários que explicam o "porquê" envelhecem mal:

- Viram inconsistentes quando o código muda
- O leitor para de confiar neles
- O Git já guarda a história; o `git log` mostra o "porquê"

**Regra adotada:** comentário só fica se apagar ele faz alguém repetir o erro. O resto vai para documentação (`docs/ci_cd/decisoes.md`).

---

## O que foi removido

| Arquivo             | Linhas antes | Linhas depois | Comentários removidos |
| ------------------- | ------------ | ------------- | --------------------- |
| `docker-stack.yml`  | 148          | 78            | 70                    |
| `cd.yml` (workflow) | 247          | 169           | 78                    |
| `Dockerfile.core`   | 72           | 26            | 46                    |
| `entrypoint.sh`     | 52           | 23            | 29                    |

**Total:** ~223 linhas de comentários removidas dos 4 arquivos.

---

## O que sobrou (e por que ficou)

| Arquivo          | Comentário            | Por que ficou                                           |
| ---------------- | --------------------- | ------------------------------------------------------- |
| `entrypoint.sh`  | `#!/bin/sh` (shebang) | Obrigatório; sem ele o container não sabe como executar |
| _(nenhum outro)_ | —                     | —                                                       |

**Zero comentários** de explicação restaram nos 4 arquivos. O conteúdo que era comentário virou documentação em `docs/ci_cd/decisoes.md`.

---

## Exemplo do que saiu

### `docker-stack.yml` (antes)

```yaml
# ## Por que o Postgres fica preso ao compute01
#
# O volume `omnia_postgres_data` e LOCAL: ele nao viaja entre nos do
# Swarm. Se o container do Postgres mudar de servidor, sobe la um banco
# VAZIO, e o backend passa a conectar num banco sem as tabelas dele.
#
# O sintoma e o mesmo de migration nao aplicada: "relation
# conversations does not exist". A diferenca e que a migration roda e
# reporta sucesso -- ela cria o schema no banco errado.
#
# ...
constraints:
  - node.hostname == compute01
```

### `docker-stack.yml` (depois)

```yaml
constraints:
  - node.hostname == compute01
```

O "porquê" está em `docs/ci_cd/decisoes.md#o-postgres-preso-ao-compute01`.

---

## O que mudou na documentação

### `docs/ci_cd/decisoes.md` (novo)

12 decisões documentadas, cada uma com:

- **Decisão** (nome curto)
- **Motivo curto** (uma linha)
- **Explicação completa** (o que substitui, consequência, como conferir)

Exemplo:

````markdown
## O Postgres preso ao compute01

O volume `omnia_postgres_data` e LOCAL: ele nao viaja entre nos do
Swarm. Se o container do Postgres mudar de servidor, sobe la um banco
VAZIO, e o backend passa a conectar num banco sem as tabelas dele.

O sintoma e o mesmo de migration nao aplicada: "relation
conversations does not exist". A diferenca e que a migration roda e
reporta sucesso -- ela cria o schema no banco errado.

Por isso a constraint:
```yaml
placement:
  constraints:
    - node.hostname == compute01
````

### Por que hostname e não label

|                    | hostname | label                            |
| ------------------ | -------- | -------------------------------- |
| Precisa de preparo | não      | `docker node update --label-add` |
| Falha visível      | nenhuma  | stack em `Pending` se faltar     |

O nome do nó é um fato que já existe. O label é algo que alguém precisa
configurar, e esquecê-lo trava a stack inteira.

````

---

## O que mais mudou junto (no mesmo commit)

Além de remover comentários, o commit `5846d80` fez **duas mudanças importantes**:

### 1. Senha do Postgres saiu do `docker secret` → `.Env` da stack

**Antes (stack):**
```yaml
secrets:
  - postgres_password
environment:
  POSTGRES_PASSWORD_FILE: /run/secrets/postgres_password
````

**Depois (stack):**

```yaml
environment:
  POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:?defina POSTGRES_PASSWORD no .Env da stack}
  DATABASE_URL: postgresql://${POSTGRES_USER:-omnia_user}:${POSTGRES_PASSWORD:?...}@postgres:5432/...
```

**Consequências:**

- O `:?` faz o Swarm **recusar a stack** com mensagem explícita se `POSTGRES_PASSWORD` não existir
- O `entrypoint.sh` não precisa mais ler `/run/secrets/` nem reescrever a URL com `sed`
- O Swarm monta a `DATABASE_URL` a partir das variáveis

### 2. `entrypoint.sh` simplificado (11 linhas a menos)

**Antes:**

```sh
# Lê senha do secret, faz sed na DATABASE_URL
if [ -n "${POSTGRES_PASSWORD_FILE:-}" ] && [ -f "${POSTGRES_PASSWORD_FILE}" ]; then
  POSTGRES_PASSWORD="$(cat "${POSTGRES_PASSWORD_FILE}")"
  DATABASE_URL="$(echo "${DATABASE_URL:-}" | sed "s/:[^:@]*@/:${POSTGRES_PASSWORD}@/")"
  export DATABASE_URL
fi
```

**Depois:**

```sh
# O Swarm já montou a DATABASE_URL com a senha interpolada
if [ -n "${DATABASE_URL:-}" ]; then
  echo "[entrypoint] esperando o postgres"
  ...
```

---

## Métricas

| Métrica                           | Antes | Depois                                 |
| --------------------------------- | ----- | -------------------------------------- |
| Linhas de comentário (4 arquivos) | ~223  | 0 (exceto shebang)                     |
| Linhas totais `docker-stack.yml`  | 148   | 78                                     |
| Linhas totais `cd.yml`            | 247   | 169                                    |
| Linhas `Dockerfile.core`          | 72    | 26                                     |
| Linhas `entrypoint.sh`            | 52    | 23                                     |
| Arquivo de decisões               | —     | `docs/ci_cd/decisoes.md` (12 decisões) |

---

## Princípio adotado

> **Comentário que explica o código é redundante.**
> **Comentário que explica a decisão evita repetição do erro.**
> **Decisão documentada fora do código vive mais que o código.**

---

## Verificação

```bash
# Confere que não sobrou comentário (exceto shebang)
grep -n '^#' apps/docker/pw2c/docker-stack.yml .github/workflows/cd.yml apps/docker/Dockerfile.core apps/docker/entrypoint.sh

# Deve retornar apenas:
# apps/docker/entrypoint.sh:1:#!/bin/sh
```
