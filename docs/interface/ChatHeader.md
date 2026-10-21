# ChatHeader

## Objetivo

Documentar o componente de cabeçalho usado nas visualizações do chat.

## Uso registrado

Os documentos históricos de `MiniChat` (P1-T04) e `ExpandedChat` (P1-T05) listam `ChatHeader` como parte da composição das duas visualizações.

## Responsabilidade esperada

O cabeçalho deve concentrar a apresentação e os controles próprios da região superior do chat, conforme a implementação real. A documentação de origem não detalha suas props, botões, ícones ou callbacks; por isso, esses detalhes precisam ser confirmados em `ChatHeader.tsx`.

## Boas práticas

- Manter o cabeçalho focado na apresentação e nos eventos que recebe.
- Deixar o estado compartilhado e a coordenação de abertura/expansão na camada responsável, como `App` ou o componente pai definido pelo código.
- Evitar chamadas de API e regras de negócio no cabeçalho.
- Preservar acessibilidade dos controles interativos.

## Validação

Após alterações, executar as validações definidas pelo projeto e verificar manualmente os controles do cabeçalho.

> Esta página foi criada a partir das referências de composição encontradas nos documentos fornecidos. Revise-a contra `ChatHeader.tsx` para completar o contrato real.