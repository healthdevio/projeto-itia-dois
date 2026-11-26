# Integração com Host — Task 03: Receber ferramentas do Host

## Objetivo

Receber o catálogo de ferramentas publicado pelo Host junto com o contexto da
conversa, validar e normalizar o que chegou e entregar ao Core uma lista **já
filtrada pelas permissões** do principal. A camada de I.A. consumirá esse
catálogo em task posterior; nesta task nada é conectado ao fluxo de mensagens.

## Resultado entregue

1. `HostIntegration` continua exposta por `HOST_INTEGRATION`, sem transporte
   concreto; o provider padrão permanece explícito e seguro.
2. `HostToolCatalogService.getAvailableTools({ identity, conversationId, signal? })`
   devolve `{ tools, chat_context, discarded }`.
3. O mesmo carregamento de contexto fornece grants e ferramentas, evitando
   combinar permissões de um turno com catálogo de outro.
4. JSON Schema de cada ferramenta é compilado pelo Ajv antes da exposição.
5. Ferramentas sem todos os grants são omitidas do catálogo exposto.
6. Descartes são registrados como contagens, sem nomes, schemas, argumentos ou
   segredos.

## Fluxo

```text
JWT OIDC -> IdentityGuard -> RequestIdentity (userId, tenantId?)
                                   |
                                   v
HostToolCatalogService.getAvailableTools(identity, conversationId, signal?)
                                   |
                                   v
HostContextService.load -> HostIntegration.loadConversationContext
                                   |
                                   v
parseHostConversationContext (validação, limites, duplicados, permissões)
                                   |
                                   v
Ajv: schema compilável? -> authorizeToolCall: grants suficientes?
                                   |
                                   v
{ tools, chat_context, discarded }
```

## Componentes

| Arquivo                                          | Papel                                                             |
| ------------------------------------------------ | ----------------------------------------------------------------- |
| `src/services/host/host-tool-catalog.service.ts` | Orquestra catálogo filtrado, contagens e log agregado             |
| `src/services/tools/tool-arguments-validator.ts` | `isToolSchemaCompilable`, usando o mesmo Ajv da validação de args |
| `src/services/host/host-context.service.ts`      | Principal, deadline, cancelamento, parsing e auditoria (Task 02)  |
| `src/services/host/host-context.parser.ts`       | Formato, limites, duplicados e formato `dominio.acao`             |
| `src/services/host/host-context.config.ts`       | Limites, timeout e flag lidos do ambiente                         |
| `src/services/host/host-integration.provider.ts` | Provider padrão sem Host: falha com `host_unavailable`            |
| `src/services/host/host.module.ts`               | Registro Nest e ponto único de troca do adaptador real            |
| `src/services/tools/tool-authorization.ts`       | Decisão de autorização reutilizada (`authorizeToolCall`)          |

## Identidade

O parâmetro é `RequestIdentity`, preenchido pelo `IdentityGuard` a partir do JWT
OIDC validado. O serviço converte internamente para `HostPrincipal` via
`HostContextService`, exatamente como no recebimento de contexto. Nenhum dado do
cliente — corpo, headers, `chat_context` ou texto da IA — pode construir o
principal nem acrescentar grants.

## Política de filtragem

- **Grants:** os únicos grants considerados são `chat_context.permissions` do
  mesmo carregamento. A decisão chama `authorizeToolCall`, das Tasks 05–06, sem
  reimplementar a checagem de permissões.
- **Sem grant:** a ferramenta é **omitida** do catálogo exposto à I.A., não
  marcada como indisponível. Isso evita que o modelo tente usá-la. Ferramentas
  com `required_permissions: []` são expostas.
- **Schema inválido:** `input_schema` que o Ajv não consegue compilar é
  **descartado** e contabilizado em `discarded.invalid_schema`. A resposta inteira
  não é recusada por isso; a ferramenta simplesmente não é exposta.
- **Duplicados:** já são rejeitados por `parseTools` com `unknown` e uma contagem
  de ferramentas. Mantém-se a política fail closed: se o Host devolve catálogo
  estruturalmente inválido, nada é exposto.
- **Permissão em formato inválido:** também é rejeitada pelo parser com
  `unknown`; grants malformados nunca são interpretados de forma permissiva.
- **Dados do Host:** não ampliam permissões nem substituem a validação do Core.

## Limites e configuração

Nenhum número novo foi inventado: o serviço reutiliza os limites e o timeout da
Task 02, configuráveis por ambiente e com valores provisórios:

| Variável                       | Padrão  | Limite                                  |
| ------------------------------ | ------- | --------------------------------------- |
| `HOST_CONTEXT_MAX_BYTES`       | `32768` | Resposta serializada em UTF-8           |
| `HOST_CONTEXT_MAX_TOOLS`       | `50`    | Ferramentas no catálogo                 |
| `HOST_CONTEXT_MAX_PERMISSIONS` | `100`   | Permissões no contexto e por ferramenta |
| `HOST_CONTEXT_MAX_TOOL_NAME`   | `256`   | Nome de ferramenta                      |
| `HOST_CONTEXT_MAX_STRING`      | `4000`  | Textos livres                           |
| `HOST_CONTEXT_TIMEOUT_MS`      | `5000`  | Deadline da chamada                     |

Configuração inválida falha no boot. Os valores não são decisão final de
produção; dependem de confirmação com Tools e Segurança.

## Falhas

`HostIntegrationError` é propagada tipada para o chamador do catálogo:

| Situação                                      | Código                     | Comportamento do Core nesta task                  |
| --------------------------------------------- | -------------------------- | ------------------------------------------------- |
| Adaptador sem Host configurado                | `host_unavailable`         | Falha explícita; não há catálogo vazio silencioso |
| Host não responde no deadline                 | `timeout`                  | Falha explícita                                   |
| Host recusa identidade/escopo                 | `unauthorized`/`forbidden` | Falha explícita                                   |
| Payload inválido, duplicado ou permissão ruim | `unknown`                  | Falha explícita, sem exposição parcial            |
| Chamador cancela                              | `unknown`                  | Resultado desconhecido, sem dados parciais        |
| Host publicou lista vazia                     | —                          | Sucesso com `tools: []` e `discarded` zerado      |

**Proposta documentada, sem alterar o fluxo atual:** quando a task de I.A. ligar
o catálogo ao turno de mensagem, uma falha ao carregar o catálogo deve ser
tratada como falha da chamada (a conversa não segue com ferramentas inventadas
nem com um catálogo vazio que pareça sucesso). A decisão final de UX/HTTP fica
para essa task; hoje `/api/messages` não foi alterado.

## Cache e escopo

Não há cache persistente nem em memória além da duração da chamada. O catálogo
nunca deve ser reutilizado entre usuários ou tenants, porque grants podem mudar
durante a sessão.

## Provider padrão "sem Host"

`createUnconfiguredHostIntegration()` continua sendo o provider de
`HOST_INTEGRATION` no `HostModule`. Ele rejeita `loadConversationContext` e
`executeTool` com `host_unavailable`, em vez de devolver contexto vazio. Trocar o
adaptador real é substituir apenas esse provider; nenhum protocolo, rede ou
auth serviço-a-serviço foi implementado.

## Ponto de consumo pela I.A.

O catálogo deve ser consumido no turno de mensagem, **antes** de montar o prompt
e a requisição ao provider:

1. `messages.controller.ts` já recebe o `HostConversationContext` quando
   `HOST_CONTEXT_ENABLED=1`, mas hoje usa só `chat_context` e descarta `tools`;
2. a task de I.A. deve chamar `HostToolCatalogService.getAvailableTools` com a
   identidade verificada e a conversa atual no mesmo ponto em que o contexto
   é carregado;
3. `tools` filtradas entram na descrição das ferramentas disponíveis para o
   modelo; `chat_context.permissions` continua sendo apenas dado da conversa;
4. se o modelo devolver uma chamada, localizar a ferramenta nesse catálogo,
   chamar novamente `authorizeToolCall` com os grants do mesmo turno, validar
   argumentos com `validateToolArguments` e só então encaminhar ao
   `executeTool` do Host, com principal e `signal` do turno.

Nada disso está ligado nesta task: `POST /api/messages`, `AIContext`,
`AIRequest` e providers continuam com o comportamento anterior.

## Questões em aberto

- Qual é o Host alvo e qual protocolo (HTTP/gRPC/SDK/fila) será usado?
- Como será feita a autenticação serviço-a-serviço?
- Quais timeouts e política de retries são esperados em produção?
- Quais são os limites definitivos de catálogo/schema?
- Quem de Tools e Segurança revisou a semântica de autorização e os limites?

## Estado anterior confirmado no código

- `HostIntegration` tem versão `1.0.0`, dois métodos e `AbortSignal` opcional;
  `executeTool` existe, mas não é chamado em produção.
- `authorizeToolCall` checa primeiro `tool_mismatch` e depois
  `missing_permissions`; `required_permissions: []` é autorizado e contexto sem
  `permissions` equivale a nenhum grant. A ordem em `executeToolCall` é
  autorização → validação de argumentos → executor.
- O adaptador em memória (`test/helpers/host-integration.fake.ts`) registra
  `context_requests` e `executed_calls`, mas não lê `signal`.
- Divergências conhecidas entre documentação e código: a doc diz que o
  adaptador propaga a versão do contrato e que o Core não chama o Host sem
  tenant; o código não faz nem uma coisa nem outra. A doc também trata a
  auditoria como não implementada, embora a Task 02 registre contagens e a
  Task 03 registre descartes. Limite de resultado de ferramenta ainda não se
  aplica, porque não há execução em produção.

## Fora do escopo desta task

- executar ferramentas no Host ou ligar chamadas ao provider de IA;
- escolher transporte, protocolo ou autenticação serviço-a-serviço;
- alterar endpoints públicos, OIDC, Docker, workflows ou frontend;
- persistir auditoria/cache em banco;
- adicionar dependências (Ajv já existia).

## Validação realizada

Executada nesta branch, antes de qualquer commit:

- `npm ci` (o `node_modules` existente estava desatualizado, sem `zod`) — passou;
- `npm run typecheck` — passou;
- `npm run lint` — sem findings;
- `npm test` — 199 testes, 199 passando;
- `npm run build` — passou;
- `npm run format:check` na raiz — passou, após formatar somente os arquivos
  alterados;
- `git diff --check` — sem erros.
