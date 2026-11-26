# Contrato de integração com o Host

## Objetivo e limite

Este contrato define como o Core obtém do Sistema Host o contexto confiável de
uma conversa, as ferramentas disponíveis e o resultado de uma execução. Ele é
independente do provider/modelo de IA: o Host não envia prompts nem escolhe
provider, e a integração com IA não acessa diretamente o Host.

O contrato é uma interface TypeScript interna, em
`apps/chat-back/src/models/host-integration.ts`. Ela define a fronteira entre o
Core e um adaptador do Host; não fixa HTTP, SDK ou outro transporte. Um adaptador
poderá implementar essa interface usando o mecanismo acordado com cada Host.

## Assinatura do contrato

```ts
interface HostIntegration {
  loadConversationContext(
    request: HostContextRequest,
  ): Promise<HostConversationContext>;

  executeTool(request: HostToolExecutionRequest): Promise<HostToolOutput>;
}
```

| Método                    | Entrada                    | Saída                     | Rejeita com `HostIntegrationError` quando                                                            |
| ------------------------- | -------------------------- | ------------------------- | ---------------------------------------------------------------------------------------------------- |
| `loadConversationContext` | `HostContextRequest`       | `HostConversationContext` | identidade inválida, tenant não permitido, Host indisponível, timeout                                |
| `executeTool`             | `HostToolExecutionRequest` | `HostToolOutput`          | chamada não autorizada, ferramenta/recurso ausente, argumentos recusados, indisponibilidade, timeout |

Ambos os métodos aceitam `signal?: AbortSignal` opcional para cancelamento.
Nenhuma das duas operações resolve com sucesso vazio para representar falha.

## Identidade e confiança

O Core constrói `HostPrincipal` somente após validar o JWT OIDC. `user_id`
corresponde ao subject verificado e `tenant_id`, quando presente, vem do claim
configurado. O adaptador mapeia esses valores da identidade verificada do Core;
o navegador nunca constrói o `HostPrincipal`. Valores enviados pelo navegador
em headers, corpo, contexto ou argumentos de ferramenta não substituem essa
identidade.

O adaptador encaminha ao Host a identidade verificada usando autenticação
serviço-a-serviço apropriada ao ambiente. Segredos e tokens de serviço ficam no
backend. O Host deve verificar novamente a autorização no momento da execução
da ferramenta; as permissões do contexto não substituem a autorização sobre
recursos no Host.

## Carregamento de contexto e ferramentas

O Core chama `loadConversationContext` com a identidade e a conversa atual:

```ts
interface HostContextRequest {
  principal: HostPrincipal;
  conversation_id: string;
  signal?: AbortSignal;
}
```

O Host retorna contexto e catálogo de ferramentas na mesma resposta, para que
permissões e ferramentas correspondam à mesma identidade e escopo:

```ts
interface HostConversationContext {
  chat_context: ChatContext;
  tools: Tool[];
}
```

`chat_context` usa o [modelo `ChatContext`](../../apps/chat-back/src/models/chat-context.ts):
dados de usuário, perfil, sessão, página, preferências e permissões podem ser
fornecidos conforme disponíveis e necessários. O Host deve minimizar dados
pessoais e incluir somente informações autorizadas e úteis à conversa.
`permissions` contém grants confiáveis para aquele principal; ausência de grant
significa acesso negado. O Host nunca deve derivar permissões de texto gerado
pela IA nem de valores livres do cliente.

Cada [`Tool`](../../apps/chat-back/src/models/tool.ts) contém `name`,
`description`, `input_schema` (JSON Schema) e `required_permissions`
(`PermissionCode`, no formato `dominio.acao`). O Host publica apenas ferramentas
disponíveis para o principal naquele escopo. A lista pode ser vazia.

Exemplo de resposta:

```ts
const hostContext: HostConversationContext = {
  chat_context: {
    user: { display_name: 'Ana' },
    permissions: ['customer.read'],
  },
  tools: [
    {
      name: 'buscar_cliente',
      description: 'Busca os dados de um cliente.',
      input_schema: {
        type: 'object',
        properties: { customer_id: { type: 'string' } },
        required: ['customer_id'],
        additionalProperties: false,
      },
      required_permissions: ['customer.read'],
    },
  ],
};
```

### Catálogo filtrado pelo Core

A Task 03 introduz `HostToolCatalogService`, que usa o mesmo carregamento de
contexto e devolve `{ tools, chat_context, discarded }`:

- o principal vem da identidade verificada pelo Core, nunca do cliente;
- `HostContextService` aplica deadline, cancelamento, limites e validação
  estrutural antes do catálogo ser considerado;
- `input_schema` precisa ser compilável pelo Ajv; schema inválido é **descartado**
  e contabilizado em `discarded.invalid_schema`, sem registrar seu conteúdo;
- ferramentas cujas permissões não estão todas nos grants do `chat_context` são
  **omitidas** (`discarded.not_allowed`): ausência de grant nunca concede acesso;
- ferramentas com `required_permissions: []` são expostas;
- nomes duplicados e permissões em formato inválido são **rejeitados** pelo parser
  com `unknown`, pois uma resposta estruturalmente inválida não é confiável;
- falha do Host (`host_unavailable`, `timeout` etc.) propaga `HostIntegrationError`
  tipada: nunca vira catálogo vazio silencioso. Catálogo vazio legítimo é sucesso;
- a autorização reutiliza `authorizeToolCall` das Tasks 05–06, sem reimplementar
  a decisão sobre grants.

O catálogo ainda **não** é entregue ao provider de IA nem usado para executar
ferramentas. O ponto de consumo previsto é o turno de mensagem, antes de montar
o prompt e a requisição ao provider.

## Execução de ferramentas

Quando houver uma chamada de ferramenta, o Core deve:

1. localizar a ferramenta no catálogo recebido do Host;
2. validar nome, argumentos e permissões antes de executar;
3. encaminhar ao adaptador `HostToolExecutionRequest`, contendo o principal
   verificado e o `ToolCall`;
4. devolver ao fluxo apenas um `HostToolOutput` JSON serializável, sem
   credenciais ou dados fora do escopo autorizado.

O Host recebe:

```ts
interface HostToolExecutionRequest {
  principal: HostPrincipal;
  tool_call: ToolCall;
  signal?: AbortSignal;
}
```

O [`ToolCall`](../../apps/chat-back/src/models/tool-call.ts) contém `id`,
`tool_name`, `arguments` e `context.conversation_id`. O Host deve validar
novamente acesso ao recurso e efeitos permitidos no instante da execução.
Chamadas inválidas ou não autorizadas devem ser recusadas sem efeitos
colaterais. `executeTool` resolve com `HostToolOutput` (valor JSON recursivo) ou
rejeita em caso de falha; erros não devem ser convertidos em sucesso vazio.

### Idempotência

`tool_call.id` é a chave de idempotência da chamada. O Core mantém o mesmo `id`
entre tentativas da mesma operação, e o Host pode usá-lo para não aplicar duas
vezes uma operação já concluída. O contrato não garante idempotência por si só:
quem garante é o Host, ao deduplicar por esse identificador.

### Timeout e cancelamento

- Cada chamada pode receber um `AbortSignal`.
- O timeout é política do adaptador, definido por configuração; não há valor
  fixado no contrato.
- Quando o sinal é abortado, o adaptador deve rejeitar a operação em vez de
  resolver com dados parciais.
- Cancelar não desfaz efeito já aplicado: nesse caso o Core trata o resultado
  como desconhecido, e não como falha segura.

### Retry

Regra do Core:

- **não** repetir automaticamente ferramentas com efeito colateral;
- repetir apenas operações de leitura idempotentes;
- repetir somente falhas classificadas como `timeout` ou `host_unavailable`;
- reenviar com o mesmo `tool_call.id`;
- respeitar um limite de tentativas e backoff definidos quando o adaptador for
  implementado.

## Taxonomia de erros

O adaptador traduz falhas do Host para `HostIntegrationError`, que carrega
`code`, `message` e `cause` opcional. `message` não deve expor credenciais nem
dados fora do escopo; `cause` fica restrita ao diagnóstico interno.

| Código              | Quando usar                                                         | Tratamento no Core                                                       |
| ------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `unauthorized`      | identidade ausente, inválida ou não reconhecida pelo Host           | falha definitiva; não repetir; reportar ao cliente sem detalhes internos |
| `forbidden`         | identidade válida sem escopo, tenant ou grant suficiente            | falha definitiva; não repetir; registrar a recusa                        |
| `not_found`         | ferramenta ou recurso inexistente no escopo do principal            | falha definitiva; não repetir                                            |
| `invalid_arguments` | o Host recusou argumentos na revalidação                            | falha definitiva; devolver erro de chamada, não de infraestrutura        |
| `timeout`           | a operação excedeu o tempo esperado ou foi cancelada por expiração  | retentável apenas para leitura idempotente, com o mesmo `tool_call.id`   |
| `host_unavailable`  | falha de comunicação, indisponibilidade ou erro transitório do Host | retentável apenas para leitura idempotente, com o mesmo `tool_call.id`   |
| `unknown`           | falha não classificada ou cancelamento sem código mais específico   | tratar como falha; não repetir sem decisão explícita                     |

O formato de erro específico de cada Host fica fora deste contrato; a tradução
é responsabilidade do adaptador.

## Auditoria

O Core deve registrar, por chamada:

- `user_id` e, quando houver, `tenant_id`;
- nome da ferramenta e `conversation_id`;
- horário;
- resultado: sucesso ou o código de erro.

Nunca registrar argumentos ou resultados completos, que podem conter dados
pessoais ou de negócio, e nunca registrar segredos, tokens ou headers de
autenticação. O Core já registra contagens e códigos pela Task 02 (contexto) e
pela Task 03 (catálogo); a persistência em banco ainda não existe.

## Dados do Host não são confiáveis para o modelo

Contexto e resultados de ferramentas entram no prompt e podem conter texto
malicioso, inclusive instruções de prompt injection vindas de um campo livre do
Host ou de um recurso manipulado por terceiros.

Portanto:

- esse conteúdo é **dado**, nunca instrução com autoridade;
- ele não amplia permissões, não altera grants e não substitui a validação do
  Core;
- o modelo não autoriza nada: permissões são decididas pelos grants do contexto
  e revalidadas pelo Host, conforme as Tasks 05–08.

## Detalhes do contrato

**Tenant ausente.** Se o Host exigir tenant e o `principal` não trouxer
`tenant_id`, o Core não deve chamar o Host. Se a chamada acontecer, o adaptador
rejeita com `forbidden`.

**Limites de tamanho.** Contexto e resultado precisam de limite, porque entram
no prompt e trafegam pela fronteira. Os valores devem ser decididos com Tools e
Segurança e aplicados pelo Core antes de usar o dado no prompt. Nenhum número
está fixado no contrato. A Task 02 aplica limites provisórios configuráveis por
ambiente (`HOST_CONTEXT_MAX_*`) no recebimento do contexto.

**Cache do contexto e do catálogo.** Recomenda-se carregar por conversa/turno e
não reutilizar entre usuários ou tenants. Grants podem mudar durante a sessão;
cache longo pode manter acesso revogado. A autorização de execução continua sendo
revalidada pelo Host. Nenhum cache persistente foi implementado.

**Versão.** `HOST_INTEGRATION_CONTRACT_VERSION` identifica a versão do contrato.
Uma mudança incompatível deve incrementá-la, e o adaptador informa ao Host qual
versão implementa.

## Fluxo e responsabilidades

```text
Cliente --JWT OIDC--> Core --identidade verificada--> Adaptador do Host
                                                    <-- contexto + ferramentas
Core --mensagem, contexto e ferramentas--> provider de IA
Core --validação/autorização--> Adaptador do Host --execução--> Sistema Host
```

- **Host:** fonte de contexto e permissões; declara ferramentas e executa as
  operações de negócio, revalidando a autorização.
- **Core:** valida identidade, limita o escopo, valida argumentos e permissões,
  controla a chamada ao Host e trata falhas.
- **Provider de IA:** recebe somente os dados que o Core decidir disponibilizar;
  não autentica usuários, concede permissões nem executa operações no Host.

## Estado da implementação

Os tipos formalizam o contrato. A Task 02 adicionou o recebimento controlado de
contexto no Core: principal derivado da identidade verificada, deadline e
cancelamento, validação estrutural, limites configuráveis e auditoria sem
conteúdo. O `chat_context` validado é anexado ao prompt somente quando
`HOST_CONTEXT_ENABLED=1`. A Task 03 acrescentou a camada de catálogo filtrado
(`HostToolCatalogService`), que reutiliza esse carregamento, verifica o schema
com Ajv e omite ferramentas sem grants; ela ainda não é chamada pelo fluxo de
mensagens.

Ainda não existe adaptador real nem transporte registrado. O provider padrão de
`HostIntegration` rejeita chamadas com `host_unavailable` em vez de devolver
contexto vazio, e o fluxo atual não envia catálogo de ferramentas ao provider
nem executa ferramentas do Host. O registro do adaptador concreto é o ponto de
substituição em `HostModule`.

## Referências

- [Contrato tipado](../../apps/chat-back/src/models/host-integration.ts)
- [ChatContext](../../apps/chat-back/src/models/chat-context.ts)
- [Tool](../../apps/chat-back/src/models/tool.ts)
- [ToolCall](../../apps/chat-back/src/models/tool-call.ts)
- [Task 05 — Estrutura de permissões](../tasks-devops/tools-e-seguranca/task-05/Estrutura-permissoes.md)
- [Task 06 — Implementar autorização](../tasks-devops/tools-e-seguranca/task-06/Implementar-autorizacao.md)
- [Task 07 — Bloquear ferramenta não autorizada](../tasks-devops/tools-e-seguranca/task-07/Bloquear-ferramenta-nao-autorizada.md)
- [Task 08 — Permitir execução autorizada](../tasks-devops/tools-e-seguranca/task-08/Permitir-execucao-autorizada.md)
- [Task 03 — Receber ferramentas](../tasks-devops/integracao-com-host/task-03/Receber-ferramentas.md)
