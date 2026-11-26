# MessageFeedback

## Papel na Interface

Controles de avaliação de uma resposta da IA. O componente apenas **coleta** a
escolha do usuário e **apresenta** o estado recebido: não persiste, não envia
HTTP, não interpreta o feedback e não implementa regras da IA.

## Local de uso

`MessageList → MessageItem → MessageFeedback`. Os controles só aparecem quando:

- a mensagem é uma resposta (`author === 'omnia'`);
- existe `message_id` estável na mensagem;
- o estado e o callback de feedback foram fornecidos.

Mensagens do usuário e mensagens sem identificador não recebem controles.

## Estado

O estado é mantido por `useMessageFeedback`, isolado por `message_id`:

```ts
type FeedbackRating = 'positive' | 'negative';
type FeedbackStatus =
  | 'idle'
  | 'selected'
  | 'submitting'
  | 'submitted'
  | 'error';

interface MessageFeedbackState {
  status: FeedbackStatus;
  rating?: FeedbackRating;
  error?: string;
}
```

| Estado       | Apresentação                                                       |
| ------------ | ------------------------------------------------------------------ |
| `idle`       | botões sem seleção                                                 |
| `selected`   | botão escolhido destacado (`aria-pressed="true"`)                  |
| `submitting` | botões desabilitados e texto "Registrando avaliação..."            |
| `submitted`  | escolha mantida e texto "Avaliação registrada."                    |
| `error`      | mensagem genérica em pt-BR; escolha preservada para nova tentativa |

`submitting`, `submitted` e `error` dependem de uma função de envio injetada no
hook. **Nesta branch não há contrato de feedback**, logo nenhuma função é
injetada: o clique apenas destaca a escolha (`selected`) e nada é enviado ou
persistido.

## Associação com a mensagem

A chave de estado é sempre `message_id`, nunca o índice da lista nem a posição
visual. Identificadores gerados localmente (`msg-local-<n>`) existem apenas para
isolar o estado visual das mensagens simuladas atuais; quando o fluxo real de
mensagens for integrado, o `message_id` do Back-end substitui esse valor.

## Acessibilidade e responsividade

- `aria-label` descreve cada ação e `aria-pressed` indica a seleção.
- `aria-hidden` nos ícones evita leitura duplicada por leitores de tela.
- `role="status"` para processamento/confirmação e `role="alert"` para falha.
- Botões de 28px com `flex-wrap`, adequados a telas menores.
- Sem `dangerouslySetInnerHTML`; texto do contrato é renderizado como texto.

## Contrato pendente

Back-end e equipe de IA precisam definir: formato/valores da avaliação,
identificador a enviar (mensagem e, se necessário, conversa), campo de
comentário, possibilidade de alteração, confirmação de recebimento e regras de
duplicidade. Ver `docs/tasks-frontend/task-10.md`.
