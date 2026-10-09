# P1-T05 --- Chat Expandido

-   **Task:** P1-T05
-   **Nome:** Construir a visualização expandida
-   **Status:** Concluída e integrada
-   **PR:** #14
-   **Título do PR:** `feat: implementa chat expandido`

## Objetivo

Permitir que o usuário alterne entre a visualização compacta e uma área
maior para conversação.

## Implementação

O `ExpandedChat` reutiliza:

``` text
ExpandedChat
├── ChatHeader
├── ChatStateView
├── MessageList
└── ChatInput
```

A diferença principal é o espaço disponível.

A interface atual utiliza:

``` text
h-[calc(100vh-6rem)]
max-h-[600px]
w-[600px]
```

A altura máxima foi necessária para evitar que a janela ocupasse espaço
excessivo e causasse problemas de overflow.

## Controle de estado

O `App` controla:

``` ts
isOpen
isExpanded
```

A transição é:

``` text
MiniChat
   ↓ expandir
ExpandedChat
   ↓ reduzir
MiniChat
```

As mensagens são mantidas pelo pai para que a troca de visualização não
precise criar uma nova lista.

## Reutilização

`ChatHeader`, `MessageList`, `ChatInput` e `ChatStateView` são
reutilizados nas duas visualizações.

Isso reduz duplicação e mantém o comportamento visual consistente.

## Fora do escopo

Não foram implementados:

-   mensagens reais;
-   Mia AI;
-   REST;
-   SSE;
-   RAG;
-   banco vetorial;
-   persistência real.

## Validação

-   `npm run format`
-   `git diff --check`
-   `npm run build`
-   teste manual da transição mini → expandido → mini
-   validação visual de overflow.

## Critérios de aceite

-   [x] Chat expandido.
-   [x] Transição mini/expandido.
-   [x] Reutilização dos componentes.
-   [x] Mensagens preservadas durante a troca.
-   [x] Área maior para conversação.
-   [x] Build aprovado.

## Clean Code

A reutilização dos componentes reduz duplicação. A separação entre
`MiniChat` e `ExpandedChat` também mantém cada componente responsável
por uma apresentação específica.

A próxima evolução deve evitar que ambos passem a duplicar lógica de
envio, carregamento ou integração.
