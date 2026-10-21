# SuggestionList

## Identificação

- **Task relacionada:** P1-T08 — Implementar sugestões e histórico
- **Status da task:** **WIP / em andamento; não concluída nem integrada à `develop`**, conforme o registro fornecido

## Objetivo

Apresentar sugestões de interação que ajudem o usuário a iniciar ou continuar uma conversa.

## Contrato conhecido

A documentação fornecida registra o modelo de sugestão com:

```text
Suggestion
├── suggestion_id
└── text
```

O Core documentado disponibiliza `GET /api/suggestions`, `POST /api/suggestions` e `DELETE /api/suggestions`, com o header `X-User-Id`. Confirme os contratos atuais no Core antes de implementar ou alterar o consumo.

## Histórico do WIP

O commit WIP `9cd9e42` (`wip: implementação inicial da task 08`) alterou `App.tsx` e `MiniChat.tsx`, adicionou `SuggestionItem.tsx` e criou `transport/rest/suggestions.ts`. O registro menciona uma tentativa de usar `getSuggestions()` para consultar `GET /api/suggestions`.

Foi identificado o erro:

```text
Property 'suggestions' does not exist on type 'IntrinsicAttributes'
```

A documentação atribui o problema à ausência das props necessárias em `SuggestionList`. O WIP deve ser revisado contra a arquitetura atual `apps/chat-omnia`, não copiado cegamente.

## Decisões pendentes

- Definir props e tipos de `SuggestionList`.
- Definir se selecionar uma sugestão preenche o campo de entrada ou dispara o envio.
- Definir estados de carregamento, lista vazia e erro.
- Alinhar o modelo da Interface com o contrato do Core.

## Arquitetura esperada

```text
Componentes React
       ↓
Hook / camada de estado
       ↓
Transport REST
       ↓
Chat Core
```

A comunicação HTTP não deve ficar diretamente dentro do componente visual.

## Critérios de conclusão

- [ ] Sugestões carregadas pela camada de transporte.
- [ ] Sugestões renderizadas.
- [ ] Seleção de sugestão funcionando.
- [ ] Estados loading/empty/error tratados.
- [ ] Contratos alinhados com o Core.
- [ ] Sem HTTP dentro dos componentes visuais.
- [ ] Typecheck/build e testes apropriados aprovados.
- [ ] PR aberto e integrado à `develop`.

> O documento reflete o estado WIP descrito na fonte. Confirme a branch e o código atuais antes de atualizar o status.