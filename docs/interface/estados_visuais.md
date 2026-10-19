# P1-T07 --- Estados visuais do Chat

- **Task:** P1-T07
- **Nome:** Implementar os estados visuais da Interface
- **Status:** Concluída e integrada
- **PR:** #21
- **Commit de merge registrado:** `1618ac2`
- **Commit da implementação registrado:**
  `1fab4c44d60011185a57ec7fcba3176649b83bf4`

## Objetivo

Representar visualmente diferentes condições do chatbot, permitindo que
o usuário perceba quando está no estado inicial, aguardando, processando
ou diante de um erro.

## Estados implementados

A implementação visual atual possui:

```text
greeting
idle
thinking
error
```

O `ChatStateView` seleciona a apresentação correspondente.

### greeting

Apresenta uma mensagem inicial:

```text
Como posso ajudar?
```

### thinking

Apresenta o `LoadingIndicator`.

### error

Apresenta uma mensagem de falha:

```text
Não foi possível enviar sua mensagem. Tente novamente.
```

### idle

Não apresenta uma mensagem adicional específica e deixa o fluxo normal
da conversa continuar.

## Arquitetura visual

```text
MiniChat
   └── ChatStateView
        ├── greeting
        ├── idle
        ├── thinking
        └── error

ExpandedChat
   └── ChatStateView
        ├── greeting
        ├── idle
        ├── thinking
        └── error
```

O `LoadingIndicator` foi separado para não duplicar sua implementação.

## Validação

O PR registrou:

- `npm run build` aprovado;
- teste visual dos estados `greeting`, `thinking`, `idle` e `error`.

## Diferença em relação ao Core

Este ponto é importante para a próxima integração.

A Interface atualmente trabalha com:

```text
greeting
idle
thinking
error
```

Enquanto a arquitetura atual do Core possui estados/transições
diferentes, incluindo estados como `streaming` e `success`.

Portanto, **não devemos simplesmente renomear os estados no componente
visual**. O contrato entre Core e Interface precisa definir o mapeamento
oficial.

## Cuidados

- Não permitir estados incompatíveis simultaneamente.
- Não fazer o componente visual conhecer regras internas do Core.
- Não transformar `ChatStateView` em uma máquina de estados de
  negócio.
- O estado real deve vir do contrato de integração quando a Task 14/15
  for executada.

## Clean Code

A separação do `ChatStateView` mantém a apresentação de estados fora de
`MiniChat` e `ExpandedChat`. A implementação usa retornos antecipados,
mantendo cada caso simples.

Entretanto, conforme o número de estados crescer, é importante evitar
uma cadeia extensa de `if`s. O mapeamento deve ser revisado quando os
estados oficiais do Core forem integrados.
