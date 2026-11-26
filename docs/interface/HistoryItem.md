# HistoryItem

## Identificação

- **Task:** Front-end [08] — Implementar sugestões e histórico
- **Arquivo:** `apps/chat-omnia/src/interface/history/HistoryItem.tsx`
- **Estado:** implementado na Interface; integração com o Core **não** está feita

## Objetivo

Representar **uma conversa anterior** dentro do `HistoryPanel`. Não é botão:
o contrato atual não expõe uma rota para reabrir uma conversa encerrada.

## Props

```ts
interface HistoryItemProps {
  conversation: Conversation;
}
```

## Campos exibidos (todos presentes no contrato)

| Exibição                                               | Origem                              |
| ------------------------------------------------------ | ----------------------------------- |
| Data da última alteração (pt-BR, em `<time dateTime>`) | `conversation.updated_at`           |
| Data de criação, quando diferente da última alteração  | `conversation.created_at`           |
| Contagem de mensagens (`N mensagem`/`N mensagens`)     | `conversation.messages.length`      |
| Prévia da última mensagem com autor (`Você` / `Omnia`) | `messages.at(-1).message` e `.role` |

`formatDateTime` retorna `null` para datas ausentes ou inválidas; nesse caso a
data não é renderizada e aparece o rótulo genérico "Conversa anterior". O texto
da mensagem vem do Back-end e é renderizado como **texto**, nunca como HTML.

## Pendências

- Definir seleção/reabertura de conversa quando o Back-end expuser esse suporte.
- Confirmar se a prévia da última mensagem é desejada pelo produto (ela usa
  somente campos do contrato, mas é uma decisão de apresentação).
- Testes de Interface.
