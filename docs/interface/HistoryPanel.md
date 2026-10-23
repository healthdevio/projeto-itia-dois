# HistoryPanel

## Identificação

- **Task relacionada:** P1-T08 — Implementar sugestões e histórico
- **Status da task:** **WIP / em andamento; não concluída nem integrada à `develop`**, conforme o registro fornecido

## Objetivo

Apresentar ao usuário a área de histórico de conversas, permitindo visualizar conversas anteriores de acordo com o contrato que vier a ser definido e integrado.

## Situação documentada

O registro da Task 08 inclui a implementação do histórico como uma das entregas pretendidas, mas não confirma que a visualização esteja concluída na arquitetura atual.

## Responsabilidades esperadas

- Apresentar os dados de histórico recebidos pela camada de estado.
- Separar a área que organiza os itens da apresentação de cada item individual, caso essa composição exista no código.
- Representar adequadamente estados de carregamento, ausência de conversas e erro.
- Não executar chamadas HTTP diretamente no componente visual.

## Pendências

- Confirmar o contrato atual de `Conversation` no Core.
- Definir e implementar o carregamento do histórico pela camada de transporte.
- Confirmar como a seleção de uma conversa deve funcionar.
- Tratar loading, lista vazia e erro.
- Validar typecheck/build e testes.
- Abrir e integrar um PR para a arquitetura atual.

## Arquitetura esperada

```text
Componente visual
       ↓
Hook / camada de estado
       ↓
Transport
       ↓
Chat Core
```

> A fonte fornecida não confirma props, endpoint ou comportamento final do histórico. Não trate esses detalhes como definidos sem consultar o código e os contratos atuais.