# Integração contínua

O workflow `.github/workflows/ci.yml` roda em pull requests e pushes para `develop` e `main`.

## Jobs atuais

| Job        | Valida                                                               |
| ---------- | -------------------------------------------------------------------- |
| `frontend` | Instala dependências de `apps/chat-omnia`, typecheck, lint e build.  |
| `core`     | Instala dependências de `apps/chat-back`, typecheck, testes e build. |
| `format`   | Formatação Prettier a partir da raiz do repositório.                 |
| `images`   | Build das imagens do backend e da interface após os outros jobs.     |

## Ajustes necessários

- O job `format` executa `npm run format`, que altera arquivos no checkout, e depois executa `format:check`. Use apenas `npm run format:check` na CI.
- O job `images` constrói `apps/chat-back` e `apps/chat-omnia`; a execução real do build ainda precisa confirmar o alinhamento.
- A CI e os Dockerfiles usam Node 24.
- O pacote `apps/packages/knowledge` não tem typecheck, testes ou build próprios na CI.

## Executar as validações locais

```bash
npm run format:check

cd apps/chat-back
npm ci
npm run typecheck
npm test
npm run build

cd ../chat-omnia
npm ci
npm run typecheck
npm run lint
npm run build
```
