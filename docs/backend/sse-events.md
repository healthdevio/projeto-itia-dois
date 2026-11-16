# SSE Events

## Objetivo

Este documento define o contrato dos eventos enviados pelo backend durante o processamento de uma mensagem por meio de Server-Sent Events (SSE).

O contrato padroniza os nomes dos eventos, seus respectivos payloads e a sequência de comunicação entre backend e frontend, permitindo que a interface acompanhe a geração da resposta em tempo real.

A definição desses eventos estabelece um formato comum de comunicação, independentemente do provedor de IA utilizado.

## Eventos disponíveis

O contrato define quatro eventos:

| Evento              | Descrição                                           |
| ------------------- | --------------------------------------------------- |
| `message.started`   | Indica o início do processamento da mensagem.       |
| `message.delta`     | Transporta um fragmento da resposta gerada pela IA. |
| `message.completed` | Indica a conclusão bem-sucedida do processamento.   |
| `message.error`     | Indica que ocorreu um erro durante o processamento. |

Cada evento possui um nome identificador (`event`) e um conteúdo (`data`), que contém o payload correspondente.

## Estrutura dos eventos

### `message.started`

Indica que o processamento da mensagem foi iniciado.

Payload:

| Campo        | Tipo          | Descrição                                         |
| ------------ | ------------- | ------------------------------------------------- |
| `message_id` | `string`      | Identificador da mensagem.                        |
| `state`      | `'streaming'` | Estado da conversa durante a geração da resposta. |

### `message.delta`

Transporta um fragmento da resposta gerada pela IA. Esse evento pode ser enviado várias vezes durante o processamento.

Payload:

| Campo        | Tipo     | Descrição                                           |
| ------------ | -------- | --------------------------------------------------- |
| `message_id` | `string` | Identificador da mensagem.                          |
| `delta`      | `string` | Fragmento de texto recebido da geração da resposta. |

### `message.completed`

Indica que a geração da resposta foi concluída com sucesso.

Payload:

| Campo         | Tipo           | Descrição                              |
| ------------- | -------------- | -------------------------------------- |
| `message_id`  | `string`       | Identificador da mensagem.             |
| `state`       | `'success'`    | Estado final da conversa.              |
| `suggestions` | `Suggestion[]` | Sugestões disponibilizadas ao usuário. |
| `config`      | `ChatConfig`   | Configuração aplicada à conversa.      |

A resposta completa não é repetida nesse evento, pois o frontend deve reconstruí-la a partir dos fragmentos recebidos em `message.delta`.

### `message.error`

Indica que ocorreu um erro durante o processamento da mensagem.

Payload:

| Campo        | Tipo      | Descrição                                    |
| ------------ | --------- | -------------------------------------------- |
| `message_id` | `string`  | Identificador da mensagem.                   |
| `state`      | `'error'` | Estado final da conversa.                    |
| `error`      | `string`  | Mensagem segura descrevendo o erro ocorrido. |

## Sequência dos eventos

Durante o processamento de uma mensagem, os eventos devem seguir esta sequência:

1. `message.started` é enviado uma única vez, indicando o início do processamento.
2. Zero ou mais eventos `message.delta` são enviados conforme os fragmentos da resposta são gerados.
3. O processamento termina com exatamente um dos seguintes eventos:
   - `message.completed`, quando a resposta é gerada com sucesso.
   - `message.error`, quando ocorre uma falha durante o processamento.

### Regras da sequência

- `message.started` deve ser o primeiro evento.
- `message.delta` pode ocorrer zero ou mais vezes.
- `message.completed` e `message.error` são eventos terminais e mutuamente exclusivos.
- Nenhum evento `message.delta` deve ser enviado após um evento terminal.
- `message.error` pode ser enviado após `message.started` ou após um ou mais eventos `message.delta`, caso ocorra uma falha durante o processamento.
- Cada evento deve manter o mesmo `message_id` durante o processamento da mensagem.

## Segurança e observações

- O campo `error` deve conter apenas uma mensagem segura e adequada para consumo pelo frontend.
- Não devem ser expostos stack traces, credenciais, tokens ou detalhes internos da infraestrutura.
- O contrato define os nomes e os payloads dos eventos, mas não implementa o transporte SSE.
- A implementação do streaming e a integração com os provedores de IA serão realizadas em tarefas posteriores.
- Os tipos definidos em `apps/chat-back/src/models/sse-events.ts` devem permanecer alinhados com este documento.
