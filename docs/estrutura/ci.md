# CI

`.github/workflows/ci.yml` valida o repositório em cada PR e push para `develop`
e `main`.

## Antes

O workflow tinha **um job** (`validate`) com 5 passos, e validava só a interface:
formatação, typecheck, lint e build do `chat-omnia`. O Core e o pacote
`knowledge` não eram verificados.

## Depois

Quatro jobs, em paralelo:

```
format ────┐
frontend ──┼──> images
core ──────┘
```

| Job        | Valida                                      | Antes?                    |
| ---------- | ------------------------------------------- | ------------------------- |
| `format`   | prettier na raiz do repositório             | sim, dentro do `validate` |
| `frontend` | typecheck, lint, build do `chat-omnia`      | sim                       |
| `core`     | typecheck, **testes**, build do `chat-core` | **não**                   |
| `images`   | `docker build` dos 2 Dockerfiles            | **não**                   |

### Por que jobs separados

Num job único, uma falha de formatação no Core esconderia o resultado da
interface, e quem estivesse consertando descobriria os dois problemas de uma vez
só depois de resolver o primeiro.

### Por que `images` na CI e não no CD

O CD constrói as imagens de novo, a partir do mesmo commit. A CI só confere que
o Dockerfile **constrói**: um `COPY` apontando para caminho que não existe mais é
descoberta de deploy, e deploy é o pior lugar para isso.

## Detalhes que parecem Choices mas não são

**`format` roda da raiz.** O prettier tem um único conjunto de regras para o
repositório inteiro (`.prettierrc`); verificar app por app deixaria de fora a
raiz e `docs/`.

**`format` roda em `ubuntu-latest`.** Só lá a checagem é sobre LF de verdade, que
é o que o `.gitattributes` garante. No Windows o mesmo comando passaria por
causa do `endOfLine` implícito.

**`core` roda `npm run typecheck` com dois projetos.** O `typecheck` é
`tsc --noEmit && tsc --noEmit -p tsconfig.test.json`: o `tsconfig.json` só inclui
`src/**`, então sem o segundo projeto os testes não seriam checados. Como o
`tsx` não verifica tipos, um teste com erro de tipo só apareceria no `tsc` de
outra pessoa.

**`frontend` confere que `dist/` não está versionado.** O `dist` é gerado de novo
no release. Um `dist` committado por engano quebraria o `npm ci` do servidor e
colocaria artefato velho em produção.

## Gatilhos

```yaml
on:
  pull_request:
    branches: [develop, main]
  push:
    branches: [develop, main]
```

Antes era só `develop`. `main` entrou porque o doc de versionamento diz que o PR
`develop → main` também passa por CI.

## Executar localmente

```bash
# o que a CI faz, na sua máquina
npm run format:check

cd apps/chat-core
npm run typecheck
npm test
npm run build

cd ../chat-omnia
npm run typecheck
npm run lint
npm run build
```

O `npm ci` é o que a CI usa; `npm install` local pode mascarar lockfile divergente.
