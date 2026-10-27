# HistoryItem

## Identificação

- **Task relacionada:** P1-T08 — Implementar sugestões e histórico
- **Status da task:** **WIP / em andamento; não concluída nem integrada à `develop`**, conforme o registro fornecido

## Objetivo

Representar um item individual da lista de histórico de conversas, caso essa composição esteja presente na implementação atual.

## Situação documentada

O documento original da Task 08 lista o histórico como parte do escopo, mas não fornece o contrato completo do item nem confirma sua implementação final.

## Responsabilidade esperada

- Apresentar os dados de uma conversa anterior recebidos por props.
- Manter a apresentação separada do carregamento e da comunicação com o Core.
- Expor uma interação de seleção somente conforme o comportamento definido pela arquitetura atual.
- Evitar inventar campos, datas ou identificadores que não estejam no contrato.

## Pendências

- Confirmar o modelo `Conversation` atual.
- Confirmar as props e o comportamento no `HistoryItem.tsx`.
- Definir o comportamento de seleção com `HistoryPanel`.
- Validar acessibilidade, estados visuais e testes conforme aplicável.

> A documentação de origem não especifica o contrato final do item. Verifique o arquivo `.tsx` e os modelos atuais antes de detalhar campos ou callbacks.
