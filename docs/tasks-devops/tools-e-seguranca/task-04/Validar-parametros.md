# Task 04 — Validar parâmetros das ferramentas

## Objetivo

Validar os argumentos de cada chamada contra o JSON Schema da ferramenta antes
de permitir que a chamada prossiga para execução.

## Implementado

O validador `validateToolArguments`, em
`apps/chat-back/src/services/tools/tool-arguments-validator.ts`, compila o
`input_schema` da ferramenta com Ajv e verifica os argumentos recebidos. Em caso
de falha, retorna os erros encontrados.

Os testes em
`apps/chat-back/test/services/tools/tool-arguments-validator.test.ts` cobrem:

- argumentos válidos;
- ausência de propriedade obrigatória;
- tipo incorreto;
- propriedade adicional não permitida.

A suíte completa do backend foi executada e passou durante a realização desta
task.

## Pendente para integração

Ainda não existe um executor de ferramentas conectado ao validador. Portanto,
este componente consegue identificar e reportar argumentos inválidos, mas a
garantia de que eles não chegam à execução só poderá ser verificada quando
houver um fluxo de execução.

Quando o executor for implementado, ele deverá chamar o validador antes de
executar a ferramenta e interromper a chamada caso o resultado seja inválido.

## Escopo desta task

Esta task valida argumentos, mas não executa ferramentas nem verifica
permissões. A execução e a autorização são responsabilidades de tasks
posteriores.
