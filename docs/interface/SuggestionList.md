# SuggestionList

## Identificação

- **Task:** Front-end [08] — Implementar sugestões e histórico
- **Arquivo:** `apps/chat-omnia/src/interface/suggestions/SuggestionList.tsx`
- **Estado:** implementada na Interface; integração com o Core **não** está feita

## Objetivo

Apresentar as sugestões devolvidas pelo Back-end e expor a seleção ao chamador.
O componente **não decide** o que a sugestão faz: ele apenas chama `onSelect`.

## Contrato usado

```ts
interface Suggestion {
  suggestion_id: string;
  text: string;
}
```

Origem: `apps/chat-back/src/models/suggestion.ts`. O Back-end limita a lista a
8 sugestões por conversa, o texto a 500 caracteres e o `suggestion_id` a 128.
O `suggestion_id` é único **dentro da conversa**, não globalmente.

A fonte é `GET /api/suggestions`, cujo envelope é:

```json
{
  "success": true,
  "data": { "suggestions": [{ "suggestion_id": "sg-1", "text": "Ver meus detalhes" }] }
}
```

Nesta task os dados vêm de um adaptador mock (ver
[fonte de dados](fonte-de-dados.md)); não há cliente REST nem OIDC no frontend.

## Props

```ts
interface SuggestionListProps {
  data: LoadedData<Suggestion>;
  onSelect: (suggestion: Suggestion) => void;
}
```

`LoadedData<T>` é estado da Interface (`src/hooks/useChatData.ts`), não contrato
do Back-end: `{ status: 'loading' | 'ready' | 'error', items: T[], error?: string }`.

| Prop       | Papel                                                                  |
| ---------- | ---------------------------------------------------------------------- |
| `data`     | Estado de carregamento e lista de sugestões recebida da fonte de dados |
| `onSelect` | Callback chamado com a sugestão escolhida; o chamador decide o efeito  |

## Estados

| `status`                | Comportamento                                        |
| ----------------------- | ---------------------------------------------------- |
| `loading`               | Área com `role="status"` e `LoadingIndicator`        |
| `ready` com lista vazia | Não renderiza nada — sem ruído visual                |
| `ready` com itens       | `<ul>` semântica com `<button>` por sugestão         |
| `error`                 | Área com `role="alert"` e mensagem genérica em pt-BR |

## Acessibilidade e segurança

- lista semântica (`section` + `ul` + `li`) e botões reais, navegáveis por Tab;
- `aria-label` no botão (`Enviar sugestão: <texto>`) e na seção;
- foco visível via `focus-visible:ring-2`;
- `text` é renderizado como **texto** (nenhum `dangerouslySetInnerHTML`);
- o conteúdo do Back-end não é interpretado como instrução nem amplia permissões.

## Comportamento em `App.tsx`

`onSelect` chama `addMessage({ content: suggestion.text, author: 'user' })`,
reaproveitando o envio local já existente. Não há limpeza das sugestões nem
chamada a `DELETE /api/suggestions`: isso depende do transporte REST.

## Pendências

- Cliente REST, OIDC e token (outra trilha).
- `POST`/`DELETE /api/suggestions` não são chamados por esta task.
- Integração dos estados `thinking`/`error` com o Core.
- Testes de Interface (o projeto ainda não tem framework configurado).
