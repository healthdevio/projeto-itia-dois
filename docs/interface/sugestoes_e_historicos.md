# P1-T08 --- Sugestões e histórico


> **Status desta documentação: WIP.**
>
> A Task 08 foi iniciada, possui implementação local preservada em
> commit, mas **não está concluída nem integrada à `develop` na
> arquitetura atual**.

-   **Task:** P1-T08
-   **Nome:** Implementar sugestões e histórico
-   **Status:** Em andamento / WIP
-   **Branch histórica:** `feat/implementa-estados-visuais-chat`
-   **Commit WIP:** `9cd9e42 wip: implementação inicial da task 08`

## Objetivo

Adicionar à Interface: 1. sugestões de interação; 2. histórico de
conversas.

A Interface deve apresentar os dados recebidos dos contratos do Core sem
reproduzir regras de negócio.

## Contratos conhecidos do Core

A documentação atual de sugestões define:

``` text
Suggestion
├── suggestion_id
└── text
```

O Core possui:

``` text
GET    /api/suggestions
POST   /api/suggestions
DELETE /api/suggestions
```

Eles exigem o header `X-User-Id`.

Exemplo de resposta:

``` json
{
  "success": true,
  "data": {
    "suggestions": [
      {
        "suggestion_id": "sg-1",
        "text": "Ver meus detalhes"
      },
      {
        "suggestion_id": "sg-2",
        "text": "Falar com o suporte"
      }
    ]
  }
}
```

Esses contratos pertencem ao Core. A Interface deve consumi-los por uma
camada de transporte, não chamar `fetch` diretamente dentro de
componentes React.

## Implementação WIP preservada

O commit `9cd9e42` contém:

-   alteração de `App.tsx`;
-   alteração de `MiniChat.tsx`;
-   novo `SuggestionItem.tsx`;
-   novo `transport/rest/suggestions.ts`.

A implementação WIP iniciou uma função `getSuggestions()` para consultar
`GET /api/suggestions`, armazenar sugestões no estado da Interface e
renderizar itens de sugestão.

## Problema encontrado

A implementação WIP encontrou:

``` text
Property 'suggestions' does not exist on type 'IntrinsicAttributes'
```

Isso ocorreu porque `SuggestionList` ainda não possuía as props
necessárias.

Além disso, a arquitetura posteriormente mudou de `apps/chat-mia` para
`apps/chat-omnia`. O WIP antigo deve ser tratado como referência e
migrado/revisado, não simplesmente copiado para a branch atual.

## Próximos passos técnicos

1.  Revisar o WIP contra `apps/chat-omnia`.
2.  Confirmar os contratos atuais de `Suggestion` e `Conversation`.
3.  Implementar `SuggestionList` com props tipadas.
4.  Definir o comportamento de seleção de uma sugestão.
5.  Definir se a seleção preenche o input ou dispara diretamente o
    envio.
6.  Implementar a visualização do histórico.
7.  Criar a camada de transporte correspondente.
8.  Evitar `fetch` dentro dos componentes React.
9.  Alinhar os modelos da Interface aos contratos do Core.
10. Implementar loading, vazio e erro.
11. Validar typecheck/build.
12. Criar testes.
13. Criar PR para a arquitetura atual.

## Arquitetura esperada

``` text
Componentes React
       ↓
Hook / camada de estado
       ↓
Transport REST
       ↓
Chat Core
```

Não:

``` text
Componentes React
       ↓
fetch()
       ↓
Chat Core
```

## Critérios para conclusão

-   [ ] Sugestões carregadas pelo transport.
-   [ ] Sugestões renderizadas.
-   [ ] Seleção de sugestão funcionando.
-   [ ] Histórico renderizado.
-   [ ] Estados loading/empty/error.
-   [ ] Contratos alinhados com Core.
-   [ ] Sem HTTP dentro dos componentes.
-   [ ] Typecheck aprovado.
-   [ ] Build aprovado.
-   [ ] Testes apropriados.
-   [ ] PR aberto.
-   [ ] PR integrado à `develop`.

## Clean Code e QA

A task deve priorizar nomes significativos, componentes pequenos,
ausência de duplicação, separação entre UI e transporte e tratamento
explícito de erros.

Os testes devem separar preparação, ação e asserções, seguindo o padrão
Arrange-Act-Assert. O fluxo também deve cobrir sucesso, lista vazia,
erro de API e interação com uma sugestão.
