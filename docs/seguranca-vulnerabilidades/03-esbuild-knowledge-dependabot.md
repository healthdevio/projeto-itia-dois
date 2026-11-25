# 03 - Alerta de `esbuild` no pacote `knowledge` (Dependabot #5)

## Resumo

O alerta #5 do Dependabot reportou o mesmo advisory já tratado no registro
[02 - Correção dos alertas `esbuild` e `minimatch`](./02-esbuild-minimatch-dependabot.md),
mas em outro lockfile: `apps/packages/knowledge/package-lock.json`.

A correção anterior alterou apenas `apps/chat-back`. Como o repositório não usa
npm workspaces, cada app tem manifest e lockfile próprios e o `overrides` do
backend não alcança os outros pacotes. O `knowledge` continuou com a cópia
vulnerável de `esbuild` até esta alteração.

## Como o alerta foi identificado

Dois alertas distintos apontavam para o mesmo advisory
[GHSA-67mh-4wv8-2f99](https://github.com/advisories/GHSA-67mh-4wv8-2f99):

| Alerta | Manifesto                 | Estado antes desta correção            |
| ------ | ------------------------- | -------------------------------------- |
| #1     | `apps/chat-back`          | corrigido no commit `5d2f8d25`         |
| #5     | `apps/packages/knowledge` | ainda com `esbuild@0.18.20` transitivo |

Não se tratava de duplicata dispensável: era a mesma falha numa árvore
independente, e fechar #1 não fecha #5.

## Estado encontrado

O `package.json` do pacote `knowledge` não possuía `overrides`, e o lockfile
continha a cadeia legada do `drizzle-kit`:

```text
knowledge
└─ drizzle-kit@0.31.11
   ├─ esbuild@0.25.12            (seguro)
   └─ @esbuild-kit/esm-loader@2.6.5
      └─ @esbuild-kit/core-utils@3.3.2
         └─ esbuild@0.18.20     (vulnerável)
```

Também não havia `minimatch` nem `shadcn` nesse pacote. A parte do alerta sobre
`minimatch` e suposto downgrade de `shadcn` não se aplicava a esta árvore; no
`apps/chat-omnia` o `minimatch` já resolve para `11.0.9` e o `shadcn` não consta
no `package.json`.

### Por que a atualização do `drizzle-kit` não resolve

`npm view drizzle-kit version dependencies` mostra que `0.31.11` é a versão
publicada mais recente e ainda declara `@esbuild-kit/esm-loader@^2.5.5`. Não há
versão upstream que remova a dependência legada, então subir `drizzle-kit` não
elimina a cópia vulnerável.

## O que foi alterado

Foi replicado o override já usado no backend, restrito ao consumidor legado:

```json
{
  "overrides": {
    "@esbuild-kit/core-utils": {
      "esbuild": "0.28.2"
    }
  }
}
```

Arquivos alterados:

- `apps/packages/knowledge/package.json`: inclusão do bloco `overrides`;
- `apps/packages/knowledge/package-lock.json`: regenerado com
  `npm install --package-lock-only --ignore-scripts`.

No lockfile, as cópias aninhadas sob `@esbuild-kit/core-utils` passaram de
`0.18.20` para `0.28.2`, incluindo os binários específicos de plataforma.
Nenhuma entrada `0.18.20` permanece. O `esbuild@0.25.12` usado diretamente pelo
`drizzle-kit` e o `esbuild@0.28.2` do `tsx` foram preservados.

## Validação executada

```powershell
cd apps/packages/knowledge
npm install --package-lock-only --ignore-scripts
npm ci --ignore-scripts
npm ls esbuild --all
```

A árvore resultante após instalação limpa:

```text
knowledge
+-- drizzle-kit@0.31.11
| +-- @esbuild-kit/esm-loader@2.6.5
| | `-- @esbuild-kit/core-utils@3.3.2
| |   `-- esbuild@0.28.2 overridden
| `-- esbuild@0.25.12
`-- tsx@4.23.15
  `-- esbuild@0.28.2
```

Também foi validado que o loader do `drizzle-kit` funciona com o override,
gerando o schema sem conexão ao banco:

```powershell
npm exec -- drizzle-kit generate --dialect postgresql `
  --schema src/db/schema.ts --out <diretorio-temporario> --name esbuild-validation
```

A geração listou as 9 tabelas esperadas (`users`, `permissions`,
`user_permissions`, `user_tokens`, `chat_history`, `api_integrations`,
`knowledge_bases`, `knowledge_documents`, `knowledge_chunks`) e produziu
`0000_esbuild-validation.sql`. O diretório temporário foi removido depois.

Por fim, `npm audit` no pacote passou a reportar `found 0 vulnerabilities`.

`npm install --package-lock-only` também imprimiu `found 0 vulnerabilities`
durante a atualização do lockfile.

## Risco e limites

- `esbuild` é dependência de desenvolvimento neste pacote: só entra na árvore
  por meio do `drizzle-kit` e do `tsx`.
- Nada no pacote invoca a API `Serve` do esbuild (`esbuild --serve`), que é o
  vetor do advisory.
- `apps/docker/Dockerfile.knowledge` executa `npm ci` e
  `npx drizzle-kit migrate`, não publica porta e não recebe tráfego.
- A exposição exigiria um servidor de desenvolvimento do esbuild ativo e um
  site malicioso aberto no mesmo navegador. O risco prático era baixo; a
  correção elimina o sinal e evita regressão.
- O override é paliativo enquanto o `drizzle-kit` mantiver
  `@esbuild-kit/esm-loader`. Deve ser reavaliado e removido quando a cadeia
  legada desaparecer.
- O alerta #5 só fecha quando este lockfile chegar ao branch padrão. Nenhum
  commit, push ou PR foi feito nesta alteração.

## Referências

- [Advisory do esbuild GHSA-67mh-4wv8-2f99](https://github.com/advisories/GHSA-67mh-4wv8-2f99)
- Registro anterior: [02 - Correção dos alertas `esbuild` e `minimatch`](./02-esbuild-minimatch-dependabot.md)
- Guia de Dependabot deste repositório: [docs/dependabot/README.md](../dependabot/README.md)
