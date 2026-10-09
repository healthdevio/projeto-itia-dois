## P1-T03 --- Botao_Flutuante

-   **Task:** P1-T03
-   **Nome:** Implementar o botão flutuante
-   **Status:** Concluída e integrada à `develop`
-   **PR:** #5
-   **Commit registrado:**
    `7638cb8 feat: implementa botão flutuante do chat`
-   **Branch histórica:** `feat/implementa-botao-flutuante`

## Objetivo

Criar o ponto de entrada visual do chatbot: um botão flutuante que
permite abrir e fechar a interface.

## Responsabilidades

O componente recebe:

``` ts
isOpen: boolean
onClick: () => void
```

Ele:

1.  apresenta o estado visual;
2.  exibe o ícone adequado;
3.  dispara o evento de clique;
4.  fornece identificação acessível.

Ele **não** deve:

-   chamar API;
-   fazer `fetch`;
-   consumir SSE;
-   manipular mensagens;
-   acessar histórico;
-   executar lógica da Mia AI;
-   conter regras de negócio.

## Implementação

O botão utiliza ícones do Lucide e classes Tailwind para:

-   posicionamento flutuante;
-   formato circular;
-   hover;
-   foco;
-   transições;
-   estado aberto/fechado.

O `App` mantém o estado `isOpen` e passa esse estado para o botão.

Fluxo:

``` text
App
 └── isOpen
      └── FloatingChatButton
            └── onClick()
```

## Acessibilidade

O estado do botão altera seu `aria-label`, distinguindo abertura e
fechamento.

Também foi utilizado foco visível para navegação por teclado.

## Validação

-   `npm run build`
-   `npm run format`
-   teste manual no navegador
-   abertura e fechamento
-   troca de ícone
-   hover
-   foco
-   revisão das alterações antes do commit
-   Pull Request

## Critérios de aceite

-   [x] Botão visível.
-   [x] Botão acionável.
-   [x] Posicionamento flutuante.
-   [x] Ícone de abertura/fechamento.
-   [x] Estado controlado pelo pai.
-   [x] Feedback visual.
-   [x] Acessibilidade básica.
-   [x] Build aprovado.
-   [x] PR integrado.

## Clean Code

O componente foi mantido pequeno e focado. A decisão importante foi não
colocar comportamento do chatbot dentro do botão.

Isso segue a ideia de que funções/componentes devem ter responsabilidade
única e que nomes e estrutura devem revelar intenção.

## Evolução posterior

A responsabilidade de controlar a janela do chat passou posteriormente
para `App`, que também passou a controlar `isExpanded` e as mensagens
temporárias.
