# Lint e Node no CI

**Data:** 23/11/2026
**Workflow:** `.github/workflows/ci.yml`
**Branch:** `fix/lint-ci-e-docs`

## 1. Contexto

O backend tinha um script de lint (`oxlint --type-aware src/ test/`) que **não
era executado no CI**. O job de backend rodava apenas:

```text
npm ci -> npm run typecheck -> npm test -> npm run build
```

Por isso 112 erros de `no-floating-promises` se acumularam sem que a pipeline
falhasse. O frontend já tinha `npm run lint` no job `frontend`.

Ao mesmo tempo, o CI usava **Node 24**, enquanto os Dockerfiles usavam
`node:26-alpine` e o `@types/node` do backend já era `^26`. O código validado no
CI e a imagem publicada rodavam em runtimes diferentes.

## 2. O que mudou

| Arquivo                                      | Mudança                                                |
| -------------------------------------------- | ------------------------------------------------------ |
| `.github/workflows/ci.yml`                   | `node-version: '24'` → `'26'` nos 3 jobs               |
| `.github/workflows/ci.yml`                   | Novo passo `Rodar lint` no job `backend`               |
| `.github/workflows/ci.yml`                   | Resumo do `CI OK` cita typecheck, lint, testes e build |
| `.github/dependabot.yml`                     | Comentário `node:24-alpine` → `node:26-alpine`         |
| `apps/chat-back/README.md`                   | Requisito e descrição do CI em Node 26                 |
| `docs/estrutura/ci.md`                       | Job `core` com lint; Node 26; validação local com lint |
| `docs/ci_cd/visao-geral.md`                  | CI em Node 26                                          |
| `docs/backend/refatoracao-hono-para-nest.md` | CI e container na mesma major                          |

### 2.1 Node 26

Os três jobs que configuram Node (`frontend`, `backend` e `format`) agora usam:

```yaml
- name: Configurar Node.js
  uses: actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020 # v7.1.0
  with:
    node-version: '26'
```

O `images` não configura Node: ele apenas constrói as imagens Docker, que já
partem de `node:26-alpine`.

**Por que 26 e não 24:** a imagem publicada sempre foi construída em Node 26. O
CI existia para validar o que seria publicado; manter 24 fazia o check validar
outro runtime. O `@types/node` do backend também já é da major 26.

### 2.2 Lint no backend

O passo foi inserido entre o typecheck e os testes:

```yaml
- name: Verificar TypeScript
  working-directory: apps/chat-back
  run: npm run typecheck
- name: Rodar lint
  working-directory: apps/chat-back
  run: npm run lint
- name: Rodar testes
  working-directory: apps/chat-back
  run: npm test
```

Ordem escolhida: lint é rápido e falha cedo, antes de gastar tempo com a suíte.
O script roda `oxlint --type-aware src/ test/` e cobre produção e testes.

## 3. Por que o lint importa

O caso concreto: `describe()`/`it()` do `node:test` devolvem `Promise<void>`.
Sem `void`, uma rejeição dentro de teste que “passa” vira apenas
`unhandledRejection`; o teste termina verde e a falha real fica escondida.

A regra foi mantida e os 112 erros foram corrigidos com `void`. Se o lint não
estiver no CI, a dívida volta na próxima alteração.

## 4. Validação executada

Antes de alterar a pipeline, os mesmos comandos foram rodados localmente em duas
versões de Node.

### 4.1 Backend

| Comando                                  | Node 24    | Node 26    |
| ---------------------------------------- | ---------- | ---------- |
| `npm run lint`                           | ✅ exit 0  | ✅ exit 0  |
| `npm run typecheck`                      | ✅         | ✅         |
| `npx tsc --noEmit -p tsconfig.test.json` | ✅         | ✅         |
| `npm test`                               | ✅ 122/122 | ✅ 122/122 |
| `npm run test:e2e`                       | ✅ 1/1     | ✅ 1/1     |
| `npm run build`                          | ✅         | ✅         |

### 4.2 Frontend

| Comando             | Node 24 | Node 26 |
| ------------------- | ------- | ------- |
| `npm run typecheck` | ✅      | ✅      |
| `npm run lint`      | ✅      | ✅      |
| `npm run build`     | ✅      | ✅      |

O Node 26 foi executado com `npx -y node@26`, sem trocar a versão global da
máquina de desenvolvimento.

## 5. Como reproduzir localmente

```bash
# backend
cd apps/chat-back
npm ci
npm run lint
npm run typecheck
npm test
npm run build
npx tsc --noEmit -p tsconfig.test.json

# frontend
cd ../chat-omnia
npm ci
npm run lint
npm run typecheck
npm run build
```

Para simular a versão do CI sem instalar globalmente:

```bash
npx -y node@26 node_modules/oxlint/bin/oxlint --type-aware src/ test/
```

## 6. O que continua fora do CI

| Item                        | Situação                                                        |
| --------------------------- | --------------------------------------------------------------- |
| `npm run test:e2e`          | Roda apenas localmente; não há passo no CI                      |
| `tsc -p tsconfig.test.json` | Comando disponível, mas não executado no CI                     |
| `apps/packages/knowledge`   | Sem scripts próprios de lint, teste ou build                    |
| Job `format`                | Só roda em pull request; push em `develop`/`main` não reformata |

Esses itens não foram alterados nesta mudança; ficam registrados como
oportunidades para uma próxima revisão da pipeline.

## 7. Como reverter

Para voltar ao estado anterior:

1. Trocar `node-version: '26'` por `'24'` nos três jobs.
2. Remover o passo `Rodar lint` do job `backend`.
3. Reverter os comentários e a documentação citados na seção 2.

O lint continuaria passando localmente, mas deixaria de proteger a pipeline
contra regressão.

## 8. Referências

- [Problemas encontrados e correções](../backend/problemas-encontrados.md)
- [Integração contínua](../estrutura/ci.md)
- [Visão geral da CI/CD](visao-geral.md)
- [Testes automatizados](../estrutura/testes.md)
