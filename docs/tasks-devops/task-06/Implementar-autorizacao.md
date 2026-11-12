# Task 06 — Implementar autorização

## Objetivo

Determinar se uma `ToolCall` pode prosseguir para execução com base nas
permissões exigidas pela ferramenta e nas permissões disponíveis no contexto.

## Implementação

`authorizeToolCall`, em
`apps/chat-back/src/services/tools/tool-authorization.ts`, compara
`Tool.required_permissions` com `ChatContext.permissions` e retorna uma decisão
explícita:

- autoriza quando todas as permissões exigidas estão disponíveis;
- rejeita com `missing_permissions` quando falta alguma permissão;
- rejeita com `tool_mismatch` quando o nome da chamada não corresponde à
  ferramenta verificada.

Permissões ausentes no contexto são tratadas como nenhuma permissão concedida.
Uma lista `required_permissions` vazia é autorizada, pois a ferramenta não
declara requisitos específicos.

## Testes

Os testes em
`apps/chat-back/test/services/tools/tool-authorization.test.ts` cobrem:

- chamada autorizada com todas as permissões exigidas;
- rejeição quando falta uma ou mais permissões;
- rejeição quando o contexto não concede permissões;
- autorização quando a ferramenta não declara permissões;
- rejeição quando o nome da chamada diverge do nome da ferramenta.

Para executar os testes de autorização e validação de argumentos a partir de
`apps/chat-back`:

```powershell
npm exec tsx -- --test test/services/tools/tool-authorization.test.ts test/services/tools/tool-arguments-validator.test.ts
```

## Limite de confiança

O contexto usado na autorização deve ser montado pelo backend a partir de uma
fonte confiável. Não use permissões declaradas livremente pelo cliente nem
conteúdo gerado pela IA como grants. A função decide com base no contexto
recebido; ela não autentica a identidade nem busca permissões em um provedor.

## Integração

As Tasks 07 e 08 usam esta decisão no executor comum de ferramentas: a
autorização é verificada antes da validação dos argumentos e antes de chamar o
executor fornecido pelo chamador. Esta função isolada não executa ferramentas.
