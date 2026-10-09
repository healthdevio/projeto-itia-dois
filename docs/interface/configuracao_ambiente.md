# P1-T01 --- Configuração do ambiente Front-end

## Contexto do projeto

O **Chat Omnia** é um chatbot de suporte proposto pela empresa para
auxiliar usuários/clientes em dúvidas e interações relacionadas ao
serviço. O projeto foi organizado como um **monorepo**, com
responsabilidades separadas entre Interface, Chat Core, transporte e
componentes de IA/conhecimento.

Na arquitetura atual, a Interface está em `apps/chat-omnia/` e o Chat
Core em `apps/chat-core/`. A Interface é responsável pela apresentação e
interação do usuário; regras de domínio, contratos e estados do Core
devem permanecer desacoplados da camada visual.

O desenvolvimento segue uma abordagem incremental: cada task entrega uma
parte funcional do produto sem antecipar responsabilidades de outras
camadas. Integrações reais com Core, REST, SSE, autenticação, IA e
conhecimento devem ser feitas nos pontos definidos pela arquitetura, e
não diretamente nos componentes visuais.

## Princípios utilizados

-   React + TypeScript para a Interface.
-   Vite como ferramenta de desenvolvimento/build.
-   Tailwind CSS para estilos.
-   shadcn/ui e Lucide para componentes/ícones.
-   Git/GitHub com branches e Pull Requests.
-   Separação entre apresentação, estado, transporte e domínio.
-   Clean Code: nomes significativos, funções pequenas,
    responsabilidades únicas, baixo acoplamento e refatoração
    incremental.
-   Validação antes da integração: typecheck/build/formatação e testes
    manuais quando aplicáveis.

## Identificação

-   **Task:** P1-T01
-   **Nome:** Configurar o ambiente Front-end
-   **Camada:** Interface
-   **Status:** Concluída
-   **Projeto atual:** Chat Omnia
-   **Aplicação atual:** `apps/chat-omnia/`

## Objetivo

Criar uma base executável e tipada para o desenvolvimento da Interface,
estabelecendo Vite, React, TypeScript, Tailwind CSS, shadcn/ui, aliases
e ferramentas de qualidade.

## O que foi realizado

-   Criação/configuração da aplicação React com Vite.
-   Configuração de TypeScript e JSX.
-   Configuração do Tailwind CSS.
-   Configuração do shadcn/ui.
-   Configuração de aliases de importação.
-   Instalação das dependências necessárias.
-   Configuração de scripts de desenvolvimento, build, typecheck, lint e
    formatação.
-   Validação da execução local e do build.
-   Evolução posterior da aplicação até a estrutura atual
    `apps/chat-omnia`.

A documentação oficial do TypeScript confirma que arquivos JSX com
TypeScript devem utilizar `.tsx` e que a opção `jsx` precisa estar
configurada. O projeto utiliza essa base.

## Stack registrada

-   React `^19.2.8`
-   React DOM `^19.2.8`
-   TypeScript `~6.0.2`
-   Vite `^8.3.0`
-   Tailwind CSS `^4.3.3`
-   `@tailwindcss/vite`
-   shadcn `^4.21.0`
-   Lucide React
-   ESLint
-   Prettier

A documentação atual do Tailwind recomenda a integração via plugin
`@tailwindcss/vite`, coerente com a configuração adotada. O shadcn
também possui instalação específica para Vite e suporta monorepos.

## Decisões importantes

### Vite

Foi escolhido por fornecer uma base simples para React, TypeScript e
desenvolvimento local rápido.

### TypeScript

Foi adotado para tipar componentes, props, estados e contratos futuros
da Interface.

### Tailwind CSS

Foi utilizado para manter a estilização próxima aos componentes e
facilitar a construção responsiva.

### shadcn/ui

O projeto utiliza shadcn/ui como fonte de componentes e configuração
visual. Diferentemente de uma biblioteca tradicional, os componentes
podem ser adicionados ao próprio projeto e customizados.

### Alias

O alias `@/*` foi adotado para facilitar imports dentro da aplicação e
reduzir acoplamento a caminhos relativos profundos.

## Validação

Foram utilizados:

``` bash
npm install
npm run typecheck
npm run build
npm run dev
```

A aplicação foi posteriormente validada localmente e o `npm run dev`
passou a funcionar normalmente após a sincronização das dependências.

## Cuidados

-   Não adicionar dependências sem necessidade.
-   Manter a versão de Node usada localmente alinhada com CI/Docker.
-   Não misturar configuração da Interface com regras de domínio.
-   Validar build/typecheck após mudanças estruturais.
-   Revisar vulnerabilidades reportadas pelo npm antes de qualquer
    `npm audit fix --force`.

## Relação com Clean Code

A configuração deve favorecer legibilidade e manutenção, e não criar
abstrações prematuras. O princípio de manter o código mais limpo a cada
alteração deve ser aplicado também à configuração.

## Referências técnicas

-   Vite: https://vite.dev/guide/
-   React: https://react.dev/learn
-   React --- estado e compartilhamento de estado:
    https://react.dev/learn/sharing-state-between-components
-   TypeScript + React/JSX:
    https://www.typescriptlang.org/docs/handbook/react.html
-   Tailwind CSS com Vite:
    https://tailwindcss.com/docs/installation/using-vite
-   Tailwind CSS responsivo:
    https://tailwindcss.com/docs/responsive-design
-   shadcn/ui: https://ui.shadcn.com/docs
-   shadcn/ui + Vite: https://ui.shadcn.com/docs/installation/vite
-   Lucide: https://lucide.dev/
-   GitHub Pull Requests: https://docs.github.com/en/pull-requests
