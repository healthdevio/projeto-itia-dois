# ChatResponse

## Objetivo

Definir o contrato utilizado pelo Back-end para retornar à Interface os dados de uma resposta da Omnia IA.

O contrato padroniza as informações entregues pelo endpoint `POST /api/messages`, facilitando a comunicação entre o Back-end e o Front-end.

## Estrutura

O contrato está definido em:

`apps/chat-back/src/models/chat-response.ts`

```ts
export interface ChatResponse {
  message_id: string;
  ai_response: string;
  state: ConversationState;
  suggestions: Suggestion[];
  config: ChatConfig;
}
```

## Propriedades

| Campo         | Tipo                | Descrição                                        |
| ------------- | ------------------- | ------------------------------------------------ |
| `message_id`  | `string`            | Identificador da mensagem enviada pelo usuário.  |
| `ai_response` | `string`            | Texto da resposta gerada pela IA.                |
| `state`       | `ConversationState` | Estado atual da conversa após o processamento.   |
| `suggestions` | `Suggestion[]`      | Lista de sugestões disponibilizadas à Interface. |
| `config`      | `ChatConfig`        | Configuração efetiva utilizada na resposta.      |

## Tipos reutilizados

O contrato utiliza tipos já existentes no projeto:

- `ChatConfig`, definido em `chat-config.ts`.
- `ConversationState`, definido em `conversation-state.ts` e exportado por `conversation.ts`.
- `Suggestion`, definido em `suggestion.ts`.

Essa reutilização evita duplicação de estruturas e mantém a consistência entre os modelos do Back-end.

## Relação com outros contratos

O `ChatResponse` possui uma responsabilidade diferente dos demais contratos:

- **AIResponse:** representa o resultado retornado pelo serviço de IA, incluindo a resposta textual e as sugestões, que podem ser `null`.
- **ChatResponse:** representa os dados preparados pelo controller para serem entregues à Interface. As sugestões já são resolvidas como uma lista.
- **ApiResponse:** representa o envelope padrão utilizado nas respostas HTTP, contendo o indicador de sucesso e os dados ou erro.

No retorno de sucesso do endpoint `POST /api/messages`, o controller utiliza:

`ApiResponse<ChatResponse>`

## Integração

O contrato é utilizado pelo `MessagesController`, no endpoint `POST /api/messages`.

Após processar a mensagem, obter a resposta da IA, atualizar o estado da conversa e resolver as sugestões, o controller monta o objeto `ChatResponse` e o entrega dentro do envelope `ApiResponse`.

## Observações

- O contrato formaliza a estrutura de resposta já utilizada pelo controller.
- Não substitui nem modifica o contrato interno `AIResponse`.
- Não substitui o envelope genérico `ApiResponse`.
- Não introduz novos campos ou alterações no fluxo de processamento da mensagem.
