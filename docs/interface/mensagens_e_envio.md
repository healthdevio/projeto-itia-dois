# P1-T06 --- Mensagens e campo de envio

- **Task:** P1-T06
- **Nome:** Implementar mensagens e campo de envio
- **Status:** Concluída e integrada
- **PR:** #19
- **Commit principal registrado:**
  `7723e8a675659f91591e113b8a9789d27b9b41f`

## Objetivo

Implementar a apresentação das mensagens e a entrada de texto necessária
para o usuário enviar uma mensagem.

## Implementação

A task introduziu a estrutura visual de:

```text
MessageItem
MessageList
ChatInput
```

As mensagens foram diferenciadas visualmente entre:

```ts
author: 'user' | 'omnia'
```

O fluxo atual da Interface é:

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

## Estado temporário

Para validar a interface antes da integração real, a aplicação utilizou
estado local.

Após o envio, o `App` adicionava a mensagem do usuário e uma resposta
temporária:

```text
Mensagem recebida.
```

Essa resposta é apenas um mecanismo de validação visual e **não
representa a Mia AI real**.

## Fora do escopo

A task não implementou:

- chamada real ao Core;
- REST;
- SSE;
- Mia AI;
- RAG;
- banco vetorial;
- contratos definitivos do Chat Core.

## Validação

- `npm run typecheck`
- `npm run build`
- `npm run format`
- `git diff --check`
- teste manual do envio
- teste de renderização das mensagens.

## Critérios de aceite

- [x] Mensagens do usuário exibidas.
- [x] Mensagens da Mia exibidas.
- [x] Diferenciação visual.
- [x] Campo de entrada funcional.
- [x] Ação de envio preparada.
- [x] Integração com Mini Chat.
- [x] Integração com Expanded Chat.
- [x] Build/typecheck aprovados.

## Pontos técnicos a corrigir antes da integração real

O modelo atual `author: 'user' | 'omnia'` é uma representação visual
local. O Core utiliza conceitos diferentes, incluindo
`role: user | assistant`. Portanto, a integração deve utilizar um
contrato/mapeamento explícito, e não espalhar conversões pelos
componentes.

Também é recomendável que mensagens reais possuam um identificador
estável para renderização e rastreamento, evitando usar apenas
conteúdo/autor como identidade.

## Clean Code

O componente visual deve continuar apenas apresentando dados. A lógica
de transporte deve ficar fora dos `.tsx`, preferencialmente em uma
camada de API/transport e, quando necessário, hooks responsáveis por
orquestrar estado.
