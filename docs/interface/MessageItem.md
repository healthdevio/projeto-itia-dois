# MessageItem

## Task relacionada

- **Task de origem:** P1-T06 — Implementar mensagens e campo de envio
- **Status da task de origem:** Concluída e integrada
- **PR registrado:** #19
- **Commit principal registrado:** `7723e8a675659f91591e113b8a9789d27b9b41f`

## Objetivo

Representar visualmente uma única mensagem da conversa.

## Responsabilidade

O registro da Task 06 descreve mensagens diferenciadas visualmente por autor, usando o modelo visual local:

```ts
author: 'user' | 'omnia'
```

Esse formato é histórico e não deve ser considerado automaticamente o contrato definitivo. O Backend utiliza conceitos como `role: user | assistant`; a integração deve definir um mapeamento explícito entre os modelos.

## Boas práticas

- Manter o componente focado na apresentação de uma mensagem.
- Não executar chamadas HTTP nem lógica de transporte dentro do componente visual.
- Usar uma identidade estável para cada mensagem quando o contrato atual disponibilizar um identificador.
- Evitar usar apenas o conteúdo ou o autor como identidade de renderização.

## Validação

A documentação histórica da task registra testes de renderização de mensagens e validações com typecheck/build.

> Consulte `MessageItem.tsx` e os tipos compartilhados atuais para confirmar props e modelo de dados.
