# Testes automatizados automatizados

Suíte do Backend: `apps/chat-back/test/`, **95 testes**, rodar com `node --test`
via `tsx`. Sem framework novo — `node:test` e `node:assert` já vêm no Node.

```bash
cd apps/chat-back
npm test
```

## Configuração

Dois scripts novos no `package.json`:

```json
"typecheck": "tsc --noEmit && tsc --noEmit -p tsconfig.test.json",
"test": "tsx --test \"test/**/*.test.ts\""
```

O segundo `-p` existe porque `tsconfig.json` só inclui `src/**`, então os testes
não seriam checados. E `tsx` **não verifica tipos**: um teste com erro de tipo
passa no `npm test` e quebra no `tsc` de outra pessoa.

## O que está coberto

| Arquivo                         | Cobre                                                           |
| ------------------------------- | --------------------------------------------------------------- |
| `models/chat-config.ts`         | defaults, campo a campo, valor inválido, chave desconhecida     |
| `models/suggestion.ts`          | `readSuggestions` (tolerante) e `validateSuggestions` (estrita) |
| `models/conversation.ts`        | máquina de estados e normalização de valores antigos            |
| `middleware/identity.ts`        | `X-User-Id`, `X-Tenant-Id`, formato e limite                    |
| `services/ai/context.ts`        | janela de contexto, cópia das listas                            |
| `services/ai/prompt.ts`         | config → system prompt, montagem das mensagens, JSON            |
| `services/ai/providers/echo.ts` | provider sem chave, `AI_NO_SUGGESTIONS`                         |
| `routes/messages.ts`            | 401 e 400, **sem tocar o banco**                                |
| `routes/suggestions.ts`         | 401 em 6 rotas, 400 no corpo                                    |

### `readSuggestions` tolera, `validateSuggestions` recusa

É a distinção que os testes fixam, e ela é intencional no desenho:

|                       | Entrada malformada   | Quem chama                 |
| --------------------- | -------------------- | -------------------------- |
| `readSuggestions`     | descarta em silêncio | a **AI**, na resposta      |
| `validateSuggestions` | `400` com o índice   | a **interface**, no `POST` |

Uma sugestão ruim da AI não pode derrubar a resposta que veio junto. Uma
sugestão ruim da interface precisa de erro, porque quem chamou está esperando uma
gravação.

## O que NÃO está coberto

**Nada que toque o Postgres.** Os testes de rota exercitam só o que a rota decide
antes de gravar: identidade e validação de corpo. Os 95 testes rodam sem banco.

O caminho com banco continua no harness local:

```bash
npm run smoke
```

Ele sobe o Backend contra um Postgres de verdade e exercita o fluxo ponta a ponta.
É git-ignored (regras locais de ignore do backend), porque guarda a `NVIDIA_API_KEY` de
quem roda.

Se a CI precisar cobrir o caminho com banco, o caminho é um serviço Postgres
(`pgvector/pgvector:pg16`) no runner e rodar o smoke contra ele.

## Bug encontrado pelos testes

`buildContext` devolvia a **mesma array** de `history_ids` que recebia. O teste
`copia a lista de ids do histórico` pegou:

```js
assert.notEqual(context.history_ids, ids);
```

Corrigido em `src/services/ai/context.ts`:

```diff
-    history_ids: historyIds,
+    history_ids: [...historyIds],
```

Sem isso, uma alteração posterior na lista do chamador apareceria no contexto já
entregue ao provider e registrado no log.

## Escrever um teste novo

```ts
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { validateChatConfig } from '../../src/models/chat-config.js';

describe('validateChatConfig', () => {
  it('completa com o default quando o config não vem', () => {
    const result = validateChatConfig(undefined);

    assert.equal(result.ok, true);
  });
});
```

Três pontos:

**Import com `.js`.** Mesmo importando `.ts`, a extensão é `.js` — é assim que o
`tsconfig` (`moduleResolution: bundler`) resolve.

**Nome do teste em português, descrevendo o comportamento.** Não
`test validateChatConfig 1`.

**Teste de rota sem banco.** Se a resposta não puder ser decidida antes do banco,
use `assert.notEqual(response.status, 401)` para provar que a falha foi adiante —
foi assim que os testes de identidade verificam que ela vem antes do acesso ao
banco.
