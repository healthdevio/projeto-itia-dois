# MessageList

## Task relacionada

- **Task de origem:** P1-T06 — Implementar mensagens e campo de envio
- **Status da task de origem:** Concluída e integrada
- **PR registrado:** #19

## Objetivo

Apresentar a coleção de mensagens da conversa, organizando a renderização de cada mensagem individual.

## Fluxo registrado

```text
ChatInput
   ↓
MiniChat / ExpandedChat
   ↓
App.addMessage()
   ↓
messages
   ↓
MessageList
```

O registro histórico informa que as mensagens eram mantidas no estado do `App` e exibidas pelo `MessageList`.

## Responsabilidades

- Renderizar a lista a partir dos dados recebidos.
- Delegar a apresentação de cada mensagem ao componente `MessageItem`, conforme a composição existente.
- Manter a apresentação desacoplada do transporte e das regras de negócio.
- Preservar o comportamento de rolagem definido pela implementação atual, sem presumir detalhes não confirmados no código.

## Cuidados

O modelo visual histórico usa `author: 'user' | 'omnia'`, enquanto o Backend utiliza conceitos como `role: user | assistant`. A conversão deve ser centralizada em um contrato/mapeamento explícito.

Mensagens reais devem usar identificadores estáveis quando disponíveis.

## Feedback (Front-end [10])

`MessageList` recebe `feedbackStates` (mapa indexado por `message_id`) e
`onFeedback`. A chave de renderização passou a ser `message_id`, e não
`author + índice`. Para cada resposta da IA, o estado correspondente é passado a
`MessageItem`; mensagens do usuário não recebem controles.

Como o estado é indexado pelo identificador, atualizações do histórico, novas
mensagens e nova conversa não transferem a avaliação de uma mensagem para outra.
A nova conversa limpa os estados de feedback pelo hook.

## Validação

A task original registrou validação de renderização, typecheck e build.

> Consulte `MessageList.tsx` e `MessageItem.tsx` para verificar a implementação atual, incluindo rolagem automática e props.
