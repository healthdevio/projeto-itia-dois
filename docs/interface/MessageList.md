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

## Validação

A task original registrou validação de renderização, typecheck e build.

> Consulte `MessageList.tsx` e `MessageItem.tsx` para verificar a implementação atual, incluindo rolagem automática e props.
