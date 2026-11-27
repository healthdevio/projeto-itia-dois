# Integração com Host — Task 04: Executar ferramenta através do Host

## Objetivo

Receber uma `ToolCall` proposta pelo provider de IA e processá-la por um
**pipeline de controle** no Core: conferir escopo, localizar a ferramenta no
catálogo filtrado da Task 03, autorizar com os grants confiáveis, validar os
argumentos e só então encaminhar `HostIntegration.executeTool`. O Host executa;
o modelo nunca executa nem autoriza nada.

Esta task **não** liga o serviço a `POST /api/messages` nem ao provider de IA.

## Resultado entregue

1. `HostToolExecutionService.executeToolCall({ identity, conversationId,
toolCall, catalog?, signal? })`, registrado e exportado por `HostModule`.
2. Pipeline na ordem exigida, reutilizando `executeToolCall` (Tasks 05–08),
   `HostToolCatalogService` (Task 03), `authorizeToolCall`,
   `validateToolArguments` e `withDeadline`.
3. Resultado tipado: sucesso com `output` ou falha com `error`, `code`, `stage`,
   `uncertain` e `host_called`.
4. Timeout configurável, limite de tamanho do resultado e validação recursiva
   de JSON.
5. Proteção em memória contra `ToolCall` concorrente; nenhum retry automático.
6. Auditoria estruturada mínima, sem argumentos, resultado completo ou segredos.
7. Testes no adaptador em memória e documentação atualizada.

## Quem faz o quê

| Ator | Responsabilidade                                                                          |
| ---- | ----------------------------------------------------------------------------------------- |
| IA   | Propõe uma `ToolCall`; não concede permissão, não escolhe principal, não executa.         |
| Core | Confere escopo, usa catálogo filtrado, autoriza, valida, limita, audita e controla prazo. |
| Host | Revalida acesso no instante da execução e realiza a operação de negócio.                  |

## Pipeline (ordem exata)

```text
ToolCall proposta pela IA
        |
        v
1. escopo: toolCall.context.conversation_id === conversa verificada
          principal vem da identidade verificada pelo Core
        |
        v
2. catálogo: ferramenta localizada no catálogo da Task 03
          (catalog ausente -> o serviço carrega; proveniência conferida)
        |
        v
3. autorização: authorizeToolCall com grants do mesmo carregamento
          sem grant -> bloqueia SEM chamar o Host
        |
        v
4. argumentos: validateToolArguments com o input_schema da ferramenta
          inválidos -> recusa SEM chamar o Host
        |
        v
5. execução: executeToolCall -> executor que chama HostIntegration.executeTool
          principal do Core, AbortSignal, deadline, tool_call.id
        |
        v
6. resultado: JSON puro reconstruído + limite de bytes -> resultado tipado
```

Os passos 3–5 são feitos pelo `executeToolCall` existente; o serviço não
reimplementa autorização nem validação. Ele acrescenta apenas escopo, catálogo,
timeout, verificação do resultado e auditoria.

## Associação com o catálogo da Task 03

`HostToolCatalogResult` passou a carregar `identity` e `conversationId`, que
registram a proveniência do carregamento. O serviço aceita um `catalog`
recebido de outra camada do mesmo processo somente se esses campos forem iguais
à identidade e à conversa verificadas da chamada. Se `catalog` não for passado,
o próprio serviço chama `HostToolCatalogService.getAvailableTools` com a
identidade verificada e a conversa atual. Assim, um catálogo montado pelo
cliente ou pela IA não é aceito.

A ferramenta é localizada por `tool_name` nesse catálogo. Nome inexistente é
recusado antes de qualquer chamada a `executeTool`.

## Resultado tipado

Sucesso:

```ts
{ success: true; output: HostToolOutput; host_called: true }
```

Falha:

```ts
{
  success: false;
  error: 'UNAUTHORIZED' | 'INVALID_ARGUMENTS' | 'EXECUTION_ERROR';
  code: 'unauthorized' | 'forbidden' | 'not_found' | 'invalid_arguments' |
        'timeout' | 'host_unavailable' | 'unknown';
  stage: 'scope' | 'catalog' | 'authorization' | 'arguments' |
         'duplicate' | 'host' | 'result';
  uncertain: boolean;
  host_called: boolean;
}
```

`error` reutiliza as categorias do executor existente; `code` usa a taxonomia do
contrato da Task 01; `stage` e `host_called` distinguem claramente:

- **bloqueada pelo Core** (`scope`, `catalog`, `authorization`, `arguments`,
  `duplicate`): `host_called: false`;
- **recusada pelo Host** (`stage: host`, código `unauthorized`, `forbidden`,
  `not_found` ou `invalid_arguments`): `host_called: true`;
- **falhou na execução** (`stage: host`, código `timeout`,
  `host_unavailable` ou `unknown`);
- **resultado inválido ou grande demais** (`stage: result`).

Divergência de conversa e catálogo de outra identidade/conversa usam
`code: forbidden` (escopo). Ferramenta ausente no catálogo também é tratada como
fora do escopo do principal, sem chamada ao Host. Falha do Host nunca vira
sucesso vazio.

## Falhas, timeout e estado incerto

- `withDeadline` impõe o prazo mesmo se o adaptador ignorar o `AbortSignal`.
- Deadline: `code: 'timeout'`, `uncertain: true`.
- Cancelamento do chamador: `code: 'unknown'`, `uncertain: true`.
- `host_unavailable` e `unknown` do Host: `host_called: true`, sem retry.
- Um resultado não serializável, com número não finito, chave reservada,
  profundidade excessiva ou acima do limite é rejeitado em `stage: result`.

Timeout **não** significa "não executou": o efeito pode ter sido aplicado.
`uncertain: true` sinaliza estado desconhecido. Reenviar com o mesmo
`tool_call.id` depende de o Host garantir idempotência; o Core não decide isso.

## Idempotência e concorrência

O `tool_call.id` é enviado ao Host como chave de idempotência. Além disso, o
serviço mantém um `Set` em memória com chaves
`(user_id, tenant_id, conversation_id, tool_call.id)`. Uma segunda chamada
**concorrente** com a mesma chave recebe `stage: 'duplicate'`, `uncertain: true`
e não é encaminhada. A chave é liberada ao final da operação.

Limites dessa proteção: vale apenas para uma instância do serviço em um único
processo e durante a chamada. Não cobre múltiplas réplicas, reinícios ou
reenvios sequenciais, e **não substitui** a idempotência do Host.

## Retry

Não há retry automático. O contrato não diz quais ferramentas são somente
leitura, portanto não há base confiável para repetir com segurança. Se essa
informação existir no futuro, uma política restrita a leitura idempotente
deveria ser decidida à parte, com tentativas e backoff explícitos e sempre com o
mesmo `tool_call.id`.

## Limites configuráveis

| Variável                          | Padrão  | Finalidade                     |
| --------------------------------- | ------- | ------------------------------ |
| `HOST_EXECUTION_MAX_OUTPUT_BYTES` | `16384` | Resultado serializado em UTF-8 |
| `HOST_EXECUTION_TIMEOUT_MS`       | `5000`  | Deadline da execução no Host   |

Valores inválidos falham no boot, seguindo o padrão de `HOST_CONTEXT_*`.
São provisórios, não decisão final de produção: dependem de Tools e Segurança.

## Auditoria mínima

Uma linha estruturada por chamada, via `console.log`:

```json
{
  "event": "host.tool_execution",
  "at": "...",
  "user_id": "...",
  "tenant_id": "...",
  "tool": "...",
  "conversation_id": "...",
  "tool_call_id": "...",
  "duration_ms": 0,
  "outcome": "blocked | rejected | error | invalid_result | success",
  "code": "..."
}
```

Nunca entram: argumentos da IA, resultado completo, tokens, segredos ou headers.
Persistência em banco e correlação com traces ficam pendentes; a Task 04 apenas
emite o registro no mecanismo existente.

## Resultado devolvido à IA é não confiável

Quando a task de I.A. decidir usar o `output` no prompt, ele deve ser tratado
como **dado externo**, sujeito a prompt injection. Ele não amplia permissões,
não autoriza nova chamada e não substitui a revalidação do Core/Host. Nenhum
prompt é montado nesta task.

## Ponto de uso para a task de I.A.

O serviço deve ser chamado no turno de mensagem, depois que o provider devolver
uma chamada de ferramenta e **antes** de devolver qualquer resposta ao
cliente — no ponto onde hoje `messages.controller.ts` já tem `identity` do
`IdentityGuard`, `conversation.id` do repositório e (quando habilitado) o
contexto do Host:

1. carregar o catálogo com `HostToolCatalogService.getAvailableTools` com a
   identidade verificada e a conversa atual; passar o resultado como `catalog`;
2. chamar `HostToolExecutionService.executeToolCall` com essa identidade, essa
   conversa, a `ToolCall` proposta e o `AbortSignal` do turno;
3. Ferramentas listadas no prompt devem vir do mesmo catálogo;
4. Somente o `output` de `success: true` pode seguir como dado externo; falhas
   devem ser traduzidas para a resposta/UX decidida na task de I.A.

`POST /api/messages`, `AIContext`, `AIRequest` e providers permanecem intocados.

## O que ainda não existe

- adaptador real de Host, protocolo (HTTP/gRPC/SDK/fila) e transporte;
- autenticação serviço-a-serviço;
- conexão do provider de IA ao pipeline e montagem de prompt com o resultado;
- retry seguro (inclusive política para operações somente leitura);
- idempotência garantida pelo Host por `tool_call.id`;
- auditoria/cache persistente e proteção distribuída contra duplicidade;
- limites definitivos de resultado e timeout.

## Questões em aberto

- Qual é o Host alvo e qual protocolo será usado?
- Como será feita a autenticação serviço-a-serviço?
- Quais timeouts e limites de tamanho são esperados em produção?
- O Host garante idempotência por `tool_call.id`? Por quanto tempo?
- Quais ferramentas são somente leitura e poderiam entrar numa política de retry?
- Quem de Tools e Segurança revisou a taxonomia, os limites e a auditoria?

## Passo 0 — levantamento confirmado no código

- `host-integration.ts` define contrato `1.0.0`, `executeTool`, `HostToolOutput`
  recursivo, `HostPrincipal`, `AbortSignal` e os sete `HostErrorCode`; o número
  da versão não é enviado por nenhum adaptador.
- A Task 03 está presente: `HostToolCatalogService` devolve catálogo filtrado;
  provider padrão falha com `host_unavailable`; limites e timeout são
  `HOST_CONTEXT_*`.
- `executeToolCall` faz autorização → validação de argumentos → executor;
  bloqueio não chama o executor; exceção do executor vira `EXECUTION_ERROR`;
  `authorizeToolCall` checa `tool_mismatch` antes de `missing_permissions` e
  `required_permissions: []` é autorizado.
- Não havia timeout, limite de saída, proteção contra duplicidade nem retry em
  produção para `executeTool`.
- `messages.controller.ts` obtém `identity` do guard e `conversation.id` do
  repositório; `input.conversation_id` do cliente não é lido no código.
- O adaptador em memória registra `executed_calls` e `context_requests`, mas não
  lê `signal`; cenários de lentidão/abort foram simulados com hosts próprios em
  `test/`.
- Divergências pré-existentes entre doc e código: o doc afirmava que o
  adaptador propaga a versão e que o Core não chama o Host sem tenant; o código
  não faz isso. O doc previa retry para leitura idempotente, sem informação
  confiável no catálogo; agora está explícito que nada é implementado. Limite
  de resultado de ferramenta não existia até esta task.

## Validação

Comandos e resultados estão no relatório da entrega. Nenhuma dependência nova
foi adicionada.
