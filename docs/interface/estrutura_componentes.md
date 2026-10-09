# P1-T02 --- Estrutura dos componentes da Interface

-   **Task:** P1-T02
-   **Nome:** Estruturar os componentes da Interface
-   **Status:** Concluída
-   **PR:** #1
-   **Commit:**
    `405c060 feat: adiciona estrutura dos componentes da interface`

## Objetivo

Criar uma estrutura inicial para separar as responsabilidades visuais do
Chat Omnia e evitar um único componente responsável por toda a
interface.

## Estrutura criada

A organização inicial separou:

``` text
interface/
├── chat/
├── components/
├── history/
├── messages/
├── states/
└── suggestions/
```

Na arquitetura atual, esses grupos continuam representando
responsabilidades diferentes dentro de `apps/chat-omnia/src/interface/`.

## Componentes previstos

Entre os componentes estruturados ao longo das tasks:

-   `FloatingChatButton`
-   `MiniChat`
-   `ExpandedChat`
-   `ChatHeader`
-   `ChatInput`
-   `LoadingIndicator`
-   `MessageItem`
-   `MessageList`
-   `HistoryItem`
-   `HistoryPanel`
-   `ChatStateView`
-   `SuggestionList`

## Decisão arquitetural

A estrutura foi criada antes de implementar todas as regras para que
cada task pudesse evoluir uma responsabilidade específica.

Isso evita:

-   componente monolítico;
-   mistura de UI com transporte;
-   dependência direta da Mia AI;
-   regras de negócio dentro da Interface;
-   dificuldade para testar componentes isoladamente.

## Relação com React

A divisão também permite que o estado seja mantido no nível adequado.
React recomenda elevar estado para o ancestral comum quando componentes
precisam compartilhar mudanças, em vez de duplicar o mesmo estado em
vários filhos.

Esse princípio foi utilizado posteriormente em `App.tsx`, que passou a
controlar abertura, expansão e mensagens temporárias.

## Validação

A estrutura foi formatada, versionada e integrada ao fluxo de Pull
Request.

## Critérios atendidos

-   [x] Diretórios de responsabilidade criados.
-   [x] Componentes principais identificados.
-   [x] Estrutura preparada para evolução.
-   [x] Sem regras da Mia AI dentro dos componentes.
-   [x] Compatível com as tasks seguintes.

## Clean Code aplicado

A estrutura segue o princípio de responsabilidade única e busca evitar
classes/componentes grandes. Nomes devem revelar intenção e os arquivos
devem permanecer organizados para que o leitor consiga acompanhar o
fluxo do sistema.

## Cuidados futuros

A estrutura não deve ser expandida indefinidamente apenas para criar
pastas. Novas abstrações devem surgir quando houver uma responsabilidade
real, evitando overengineering.
