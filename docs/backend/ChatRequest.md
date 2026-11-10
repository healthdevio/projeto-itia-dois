# ChatRequest

## Objetivo

`ChatRequest` representa o contrato utilizado para enviar uma solicitação de chat ao Back-end.

O modelo reúne os dados de uma mensagem e permite o envio opcional de configurações para a resposta.

## Estrutura

O modelo está definido em `apps/chat-back/src/models/chat-request.ts` e estende a interface `Message`.

| Campo        | Tipo              | Obrigatório | Descrição                  |
| ------------ | ----------------- | ----------- | -------------------------- |
| `message_id` | `string`          | Sim         | Identificador da mensagem. |
| `message`    | `string`          | Sim         | Conteúdo da mensagem.      |
| `date`       | `string`          | Não         | Data da mensagem.          |
| `metadata`   | `string`          | Não         | Metadados adicionais.      |
| `origin`     | `string`          | Sim         | Origem da mensagem.        |
| `config`     | `ChatConfigInput` | Não         | Configurações da resposta. |

### Configurações

O campo opcional `config` utiliza `ChatConfigInput`, que permite definir:

- `language`: idioma da resposta.
- `tone`: tom da resposta.
- `response_length`: tamanho da resposta.

Os valores aceitos são definidos pelo modelo `ChatConfig`.

## Exemplo

```json
{
  "message_id": "msg-example-001",
  "message": "Olá, preciso de ajuda.",
  "date": "2026-11-10T14:00:00.000Z",
  "origin": "web",
  "config": {
    "language": "pt-BR",
    "tone": "neutral",
    "response_length": "standard"
  }
}
```

## Relação com outros modelos

- `Message`: fornece os campos básicos da mensagem.
- `ChatConfigInput`: define as configurações opcionais da resposta.
- `ChatContext`: representa o contexto utilizado internamente pelo Back-end e não faz parte deste contrato.
