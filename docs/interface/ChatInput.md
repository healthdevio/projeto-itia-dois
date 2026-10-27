# ChatInput

## Task relacionada

- **Task de origem:** P1-T06 — Implementar mensagens e campo de envio
- **Status da task de origem:** Concluída e integrada
- **PR registrado:** #19
- **Commit principal registrado:** `7723e8a675659f91591e113b8a9789d27b9b41f`

## Objetivo

Oferecer o campo de entrada de texto e a ação que inicia o envio de uma mensagem.

## Fluxo de envio registrado

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

O registro da task informa que o componente recebe o conteúdo digitado e delega a atualização ao componente pai.

## Responsabilidades

- Permitir que o usuário digite uma mensagem.
- Expor a ação de envio à camada responsável pelo fluxo da conversa.
- Manter a apresentação e a interação do campo separadas da comunicação HTTP.
- Evitar chamadas `fetch` ou regras da IA diretamente no componente visual.

## Limites da implementação original

A Task 06 preparou o envio visual usando estado local para validação. A resposta temporária “Mensagem recebida.” não representava uma resposta real da IA.

## Validação registrada

- `npm run typecheck`
- `npm run build`
- `npm run format`
- `git diff --check`
- teste manual de envio

> Confirme `ChatInput.tsx` para validar props, tratamento de envio, limpeza do campo e acessibilidade atuais.
