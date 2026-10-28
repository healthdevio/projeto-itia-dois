# ChatStateView

## Task relacionada

- **Task:** P1-T07 — Implementar os estados visuais da Interface
- **Status registrado:** Concluída e integrada
- **PR registrado:** #21
- **Commit de merge registrado:** `1618ac2`
- **Commit da implementação registrado:** `1fab4c44d60011185a57ec7fcba3176649b83bf4`

## Objetivo

Representar visualmente diferentes condições do chatbot para que o usuário perceba quando está no estado inicial, aguardando processamento ou diante de uma falha.

## Estados visuais registrados

```text
greeting
idle
thinking
error
```

- **`greeting`:** apresenta a mensagem inicial “Como posso ajudar?”
- **`thinking`:** apresenta o componente `LoadingIndicator`.
- **`error`:** apresenta uma mensagem de falha.
- **`idle`:** não apresenta uma mensagem adicional específica e permite que o fluxo normal continue.

Esses são os estados visuais descritos no registro da Task 07; confirme os valores e textos atuais no código.

## Uso nas visualizações

A documentação histórica registra o `ChatStateView` dentro de `MiniChat` e `ExpandedChat`.

## Diferença em relação ao Core

O Core pode usar estados e transições diferentes, incluindo `streaming` e `success`. Não se deve renomear estados visualmente sem definir o mapeamento oficial entre os contratos do Core e da Interface.

## Cuidados

- Evitar estados incompatíveis simultaneamente.
- Não expor regras internas do Core ao componente visual.
- Não transformar o componente em uma máquina de estados de negócio.
- Centralizar o mapeamento entre estados de domínio e apresentações visuais.

## Validação registrada

O PR registrou `npm run build` aprovado e teste visual dos estados `greeting`, `thinking`, `idle` e `error`.

> Confira `ChatStateView.tsx` e o contrato atual de estados antes de modificar a integração.
