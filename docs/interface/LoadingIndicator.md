# LoadingIndicator

## Task relacionada

- **Task de origem:** P1-T07 — Implementar os estados visuais da Interface
- **Status da task de origem:** Concluída e integrada, conforme o registro fornecido

## Objetivo

Exibir um indicador visual durante o estado de processamento do chat.

## Uso registrado

O `ChatStateView` apresenta o `LoadingIndicator` quando o estado visual é `thinking`. O indicador foi separado para evitar duplicação entre as visualizações compacta e expandida.

## Responsabilidade

O componente deve se limitar à apresentação do carregamento. A decisão de quando mostrar ou ocultar o indicador deve vir do estado controlado pela camada responsável pelo fluxo da conversa.

## Cuidados

- Não realizar chamadas de API no indicador.
- Não armazenar regras de negócio ou controlar o ciclo da conversa.
- Manter o indicador consistente entre `MiniChat` e `ExpandedChat`.
- Verificar acessibilidade e se a informação de carregamento é perceptível sem depender apenas de movimento.

## Validação

O registro da Task 07 menciona teste visual dos estados e build aprovado.

> O documento de origem não detalha props ou a implementação interna do indicador. Consulte `LoadingIndicator.tsx` antes de documentar detalhes adicionais.
