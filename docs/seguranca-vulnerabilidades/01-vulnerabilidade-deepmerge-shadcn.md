# 01 - Vulnerabilidade em `deepmerge` via CLI `shadcn`

## Resumo

O Dependabot identificou `deepmerge@4.3.1` no projeto `apps/chat-omnia`. A dependência chegava pela CLI `shadcn`, diretamente e também por `@shadcn/registry`. O alerta GHSA-gcqx-w48m-w2h4 / CVE-2026-93753 classifica o problema como baixo e não informa uma versão corrigida.

## O que causava a vulnerabilidade

Nas versões afetadas (`>=4.2.0` e `<=4.3.1`), a função `mergeObject()` do `deepmerge` não validava adequadamente determinadas chaves gravadas no objeto de destino. Uma operação de merge com um objeto de origem malicioso poderia contaminar o protótipo do objeto retornado. Código que depois consultasse propriedades herdadas sem verificar se eram propriedades próprias poderia receber valores não intencionais.

O alerta era causado pela presença da dependência transitiva no grafo instalado:

```text
chat-omnia
└─ shadcn
   ├─ deepmerge@4.3.1
   └─ @shadcn/registry
      └─ deepmerge@4.3.1
```

Isso não significa que o app estivesse recebendo uma requisição maliciosa ou chamando `deepmerge` no seu próprio código. A vulnerabilidade estava no pacote instalado pela CLI e seu registry; o Dependabot sinalizou o risco porque a CLI constava em `dependencies` e incluía a versão afetada. Não havia correção upstream disponível no momento da alteração, então substituir a versão por outra faixa que ainda resolvia para `4.3.1` não seria uma correção.

## O que foi alterado

- Removido `shadcn` de `apps/chat-omnia/package.json` e suas dependências exclusivas do `package-lock.json`. Isso elimina `deepmerge` da árvore de dependências desse app.
- Removida de `src/index.css` a importação `shadcn/tailwind.css`, que deixaria de resolver sem o pacote. A busca no código não encontrou uso dos utilitários e variantes extras definidos por essa folha de estilos.
- Nenhum componente de interface gerado foi removido ou alterado.

A folha de estilos era um recurso de build fornecido pelo pacote `shadcn`; ela não era a origem da vulnerabilidade. A alteração dessa importação foi necessária apenas para que o build não dependesse mais do pacote removido.

## Impacto

- O app não instala mais a CLI `shadcn` localmente. Para voltar a gerenciar componentes com essa ferramenta, aguarde uma versão sem a dependência vulnerável ou escolha uma alternativa aprovada.
- Os componentes existentes continuam no código-fonte e não precisam da CLI para executar.
- O build de produção foi validado após a remoção. `npm ls deepmerge --all` não encontrou o pacote.
- A auditoria ainda apontava outras vulnerabilidades moderadas, sem relação com este alerta; elas devem ser avaliadas separadamente.

## Referências

- [GitHub Advisory GHSA-gcqx-w48m-w2h4](https://github.com/advisories/GHSA-gcqx-w48m-w2h4)
- [CVE-2026-93753 no NVD](https://nvd.nist.gov/vuln/detail/CVE-2026-93753)
- [Issue #273 no repositório deepmerge](https://github.com/TehShrike/deepmerge/issues/273)
