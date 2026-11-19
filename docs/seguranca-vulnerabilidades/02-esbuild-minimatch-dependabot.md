# 02 - Correção dos alertas `esbuild` e `minimatch`

## Resumo

Este documento registra a investigação e a correção de dois alertas de
dependências de desenvolvimento no monorepo:

- `esbuild` vulnerável no backend, bloqueado por uma dependência transitiva
  antiga de `drizzle-kit`;
- `minimatch` vulnerável no frontend, cuja versão 10 era exigida pelas versões
  então instaladas das ferramentas de lint.

O job que originou a investigação era uma execução do atualizador do Dependabot.
Ele falhou ao resolver uma atualização agrupada; não era uma falha de build ou
de testes da aplicação. As correções foram feitas no commit `5d2f8d25` da branch
`feat/vulnerabilidades-dependabot`.

## Como o erro foi identificado

O log do Dependabot mostrou duas limitações diferentes no grafo npm:

1. Para `esbuild`, a resolução continuava presa em `0.18.20`, apesar de existir
   uma versão corrigida. O pacote direto `drizzle-kit@0.31.11` também pedia
   `esbuild@^0.25.4`, mas seu loader transitivo tinha um intervalo incompatível.
2. Para `minimatch`, a versão instalada era `10.2.6` e o primeiro release
   corrigido indicado no alerta era `11.0.1`. Os pais transitivos ainda
   declaravam intervalos da linha 10.

O erro acontecia durante a resolução das atualizações. O Dependabot terminava
com código 1 porque não conseguia propor uma árvore que satisfizesse as
restrições; isso, por si só, não indicava que a aplicação ou sua suíte de testes
estivesse quebrada.

## Vulnerabilidade do `esbuild`

O advisory
[GHSA-67mh-4wv8-2f99](https://github.com/advisories/GHSA-67mh-4wv8-2f99)
descreve uma falha no servidor de desenvolvimento do esbuild: em versões
afetadas, um site poderia induzir um navegador a enviar requisições ao servidor
de desenvolvimento e ler respostas. O risco se aplica ao servidor de
desenvolvimento exposto; não significa que o backend de produção esteja
automaticamente executando esse servidor.

O advisory classifica como afetadas as versões `<=0.24.2` e indica correção a
partir de `0.25.0`. O alerta do Dependabot para esta árvore indicava `0.28.1`
como a versão corrigida mais antiga disponível para a resolução tentada. Foi
escolhida `0.28.2`, acima de ambos os limites e compatível com a versão já usada
por `tsx` no backend.

### Por que a versão vulnerável estava instalada

A árvore encontrada em `apps/chat-back` continha cópias distintas do esbuild:

```text
chat-back
├─ drizzle-kit@0.31.11
│  ├─ esbuild@0.25.12
│  └─ @esbuild-kit/esm-loader@2.6.5
│     └─ @esbuild-kit/core-utils@3.3.2
│        └─ esbuild@0.18.20  ← cópia vulnerável
└─ tsx@4.23.15
   └─ esbuild@0.28.2
```

`@esbuild-kit/core-utils@3.3.2` declara `esbuild@~0.18.20`. Esse intervalo
impedia o atualizador de substituir aquela cópia apenas pelo esbuild novo já
presente em outra parte da árvore. O pacote `@esbuild-kit` está depreciado e
foi incorporado ao `tsx`, mas continua sendo dependência de
`drizzle-kit@0.31.11`.

Na data da correção, `0.31.11` era a versão disponível de `drizzle-kit` e
continuava trazendo esse loader. O `npm audit fix --force` sugeria uma redução
major para `drizzle-kit@0.18.1`, que poderia alterar o comportamento das
ferramentas de banco. Essa opção não foi adotada como correção automática.

### Como o `esbuild` foi corrigido

Foi adicionado um override limitado ao consumidor legado em
[`apps/chat-back/package.json`](../../apps/chat-back/package.json):

```json
{
  "overrides": {
    "@esbuild-kit/core-utils": {
      "esbuild": "0.28.2"
    }
  }
}
```

O override afeta somente a dependência de `core-utils`; não substitui o esbuild
`^0.25.4` diretamente usado pelo `drizzle-kit`. O lockfile removeu as 23 entradas
da antiga cópia aninhada e de seus binários específicos de plataforma. Uma
instalação limpa confirma que o loader passa a resolver para o esbuild seguro
`0.28.2` compartilhado na raiz.

Esse override é uma medida de compatibilidade enquanto a cadeia legada existir.
Quando `drizzle-kit` deixar de depender de `@esbuild-kit/esm-loader`, o override
deve ser reavaliado e removido se não for mais necessário.

## Vulnerabilidade do `minimatch`

O advisory
[GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249)
descreve uma possibilidade de negação de serviço por amplificação de
`globparts`. O alerta indicava que a versão mínima corrigida era `11.0.1`;
`10.2.6`, que estava no lockfile, ainda era afetada.

### Por que a atualização estava bloqueada

No frontend, dois ramos da cadeia dependiam da linha 10:

```text
chat-omnia
├─ eslint@10.14.0
│  └─ @eslint/config-array@0.23.5
│     └─ minimatch@^10.2.6
└─ typescript-eslint@8.72.1
   └─ @typescript-eslint/typescript-estree@8.72.1
      └─ minimatch@^10.2.6
```

Atualizar apenas `minimatch` para 11 contrariaria as faixas declaradas pelos
pacotes pais. Por isso, o Dependabot não conseguia propor essa atualização
isoladamente.

### Como o `minimatch` foi corrigido

Foram atualizados os pacotes pais compatíveis:

- `eslint` de `10.14.0` para `10.15.0`; a nova versão usa
  `@eslint/config-array@0.23.6`, que aceita `minimatch` 11;
- `typescript-eslint` de `8.72.1` para `8.73.0`; sua cadeia atualizada também
  aceita `minimatch` 11.

O lockfile passou a resolver `minimatch@11.0.9`. Não foi necessário forçar uma
versão de `minimatch` incompatível com as faixas dos pais.

## Processo realizado, etapa por etapa

1. **Classificar a falha:** separar o erro de resolução do Dependabot de erros
   de CI, build ou testes da aplicação.
2. **Localizar as cópias afetadas:** usar `npm explain esbuild` e
   `npm explain minimatch` em cada app para identificar os pacotes pais e as
   versões exigidas.
3. **Comparar as restrições com as correções disponíveis:** confirmar o
   intervalo seguro dos advisories e verificar se os pais tinham versões que
   permitissem atualizar sem downgrade ou override global.
4. **Corrigir cada árvore pelo ponto adequado:** aplicar um override estreito
   para o esbuild do loader legado; atualizar `eslint` e `typescript-eslint`
   para liberar minimatch 11.
5. **Atualizar e revisar os lockfiles:** garantir que a árvore resolvida e
   reproduzida por uma instalação limpa não contenha as versões afetadas.
6. **Validar o comportamento:** executar builds, testes, lint e uma geração de
   schema com `drizzle-kit` usando o esbuild sobrescrito.
7. **Documentar o limite da correção:** não usar `npm audit fix --force` para
   mudanças major não relacionadas; encaminhar os outros avisos para triagem
   própria.

## Validação executada

As instalações limpas foram feitas com os lockfiles atualizados:

```powershell
npm ci --prefix apps/chat-back --ignore-scripts
npm ci --prefix apps/chat-omnia --ignore-scripts
```

As árvores resultantes mostraram `esbuild@0.28.2` sob
`@esbuild-kit/core-utils` e `minimatch@11.0.9` no frontend:

```powershell
npm ls --prefix apps/chat-back esbuild
npm ls --prefix apps/chat-omnia minimatch
```

Também foram executados:

- `npm run build --prefix apps/chat-back` — passou;
- `npm test --prefix apps/chat-back` — 114 testes passaram;
- `npm exec drizzle-kit -- generate --dialect postgresql --schema src/db/schema.ts --out <diretorio-temporario> --name esbuild-validation` — passou, carregando o schema sem conexão ao banco;
- `npm run lint --prefix apps/chat-omnia` — passou;
- `npm run build --prefix apps/chat-omnia` — passou;
- `npm audit` por app — deixou de reportar os dois pacotes deste registro.

O `npm audit` ainda reportava outras vulnerabilidades, principalmente em
dependências de desenvolvimento. Elas não foram corrigidas por esta alteração;
devem ser avaliadas separadamente, sem aplicar downgrades ou atualizações major
automáticas sem validar compatibilidade.

## Referências

- [Advisory do esbuild GHSA-67mh-4wv8-2f99](https://github.com/advisories/GHSA-67mh-4wv8-2f99)
- [Advisory do minimatch GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249)
- [Guia de Dependabot deste repositório](../dependabot/README.md)
