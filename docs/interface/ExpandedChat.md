# ExpandedChat

## Identificação

- **Task:** P1-T05
- **Nome da task:** Construir a visualização expandida
- **Status registrado:** Concluída e integrada
- **PR registrado:** #14
- **Título do PR:** `feat: implementa chat expandido`

## Objetivo

Permitir que o usuário alterne entre a visualização compacta e uma área maior para conversar.

## Composição registrada

```text
ExpandedChat
├── ChatHeader
├── ChatStateView
├── MessageList
└── ChatInput
```

Os componentes `ChatHeader`, `MessageList`, `ChatInput` e `ChatStateView` foram descritos como reutilizados nas visualizações compacta e expandida.

## Layout registrado

A documentação histórica registra classes Tailwind como `h-[calc(100vh-6rem)]`, `max-h-[600px]` e `w-[600px]`. Elas devem ser conferidas no código atual, pois podem ter mudado após ajustes responsivos.

## Controle de estado e transição

O registro indica que `App` controla `isOpen` e `isExpanded`, mantendo as mensagens no componente pai para preservar a conversa durante a alternância.

```text
MiniChat
   ↓ expandir
ExpandedChat
   ↓ reduzir
MiniChat
```

## Fora do escopo original

A task de visualização não implementou mensagens reais, IA, REST, SSE, RAG, banco vetorial ou persistência real.

## Validação registrada

- `npm run format`
- `git diff --check`
- `npm run build`
- teste manual da transição mini → expandido → mini
- validação visual de overflow

## Manutenção

Preservar a reutilização dos componentes compartilhados e evitar duplicar lógica de envio, carregamento ou integração entre `MiniChat` e `ExpandedChat`.

> Confira `ExpandedChat.tsx` para confirmar as classes, props e responsabilidades atuais.
