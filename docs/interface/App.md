# App

## Papel na Interface

O `App` coordena partes do estado compartilhado da interface e compõe os componentes principais do chat.

## Responsabilidades registradas

Os documentos históricos indicam que `App` controla o estado de abertura (`isOpen`), a expansão (`isExpanded`) e as mensagens mantidas durante a alternância entre `MiniChat` e `ExpandedChat`.

O fluxo de abertura registrado é:

```text
FloatingChatButton
       ↓
      App
       ↓
  isOpen = true
       ↓
    MiniChat
```

A documentação também descreve `App.addMessage()` como parte do fluxo histórico de envio de mensagens.

## Integração e limites

A documentação da Task 06 esclarece que a resposta temporária “Mensagem recebida.” era apenas um mecanismo de validação visual, não uma resposta real da IA. A Task 08, por sua vez, contém um WIP antigo para sugestões e não deve ser considerada concluída apenas por existir um commit.

A implementação atual pode ter evoluído desde esses registros. Confirme no `apps/chat-omnia/src/App.tsx` quais estados, contratos e chamadas estão efetivamente presentes.

## Boas práticas

- Manter o estado no nível apropriado para os componentes que o compartilham.
- Evitar concentrar indefinidamente responsabilidades de interface, transporte e domínio em um único componente.
- Usar a camada de transporte para comunicação HTTP, conforme a arquitetura definida.
- Mapear explicitamente os modelos da Interface para os contratos do Backend.

## Validação

Após alterações, executar typecheck/build e testes aplicáveis, além de revisar `git diff --check`.
