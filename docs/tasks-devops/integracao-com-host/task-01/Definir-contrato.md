# Integração com Host — Task 01: Definir o contrato

## Objetivo

Definir a fronteira entre o Core da Omnia IA e o Sistema Host. O contrato
estabelece como o Core solicita o contexto de uma conversa, recebe as
ferramentas disponíveis e encaminha a execução de uma ferramenta, sem acoplar
essa integração a um provider ou modelo específico de IA.

Esta revisão aprimora o contrato já existente: assinatura explícita, taxonomia
de erros, regras de execução com efeito colateral, auditoria, tratamento de
dados não confiáveis e rastreabilidade. **Não** implementa a integração.

## Contexto e dependências

O Host é a fonte de contexto e de permissões de negócio; o Core autentica a
identidade, valida chamadas e controla o fluxo; o provider de IA interpreta a
mensagem e pode propor chamadas de ferramenta, mas não autentica o usuário,
concede permissões ou executa operações no Host.

Esta task depende das Tasks 05–08 de [Tools e Segurança](../../tools-e-seguranca/):

- [Task 05 — Estrutura de permissões](../../tools-e-seguranca/task-05/Estrutura-permissoes.md):
  define permissões exigidas por ferramentas e grants disponíveis no contexto.
- [Task 06 — Implementar autorização](../../tools-e-seguranca/task-06/Implementar-autorizacao.md):
  define a decisão de autorização no Core.
- [Task 07 — Bloquear ferramenta não autorizada](../../tools-e-seguranca/task-07/Bloquear-ferramenta-nao-autorizada.md):
  impede chamadas não autorizadas.
- [Task 08 — Permitir execução autorizada](../../tools-e-seguranca/task-08/Permitir-execucao-autorizada.md):
  valida argumentos e só então permite encaminhar a chamada a um executor.

A definição é cooperativa entre a camada de IA/Core e Tools e Segurança. Esta
task formaliza o contrato entre essas partes; não substitui nem reimplementa
as validações das Tasks 05–08.

## Resultado esperado

Um contrato Host tipado e documentado, que:

1. receba uma identidade verificada pelo Core e o identificador da conversa;
2. retorne, juntos, o contexto permitido e o catálogo de ferramentas
   disponível para aquela identidade e escopo;
3. aceite chamadas de ferramenta somente após as verificações do Core;
4. devolva resultados JSON serializáveis ou sinalize falhas explicitamente;
5. continue independente do provider/modelo de IA e do protocolo de transporte.

## Localização da definição

Os tipos estão definidos em
[`apps/chat-back/src/models/host-integration.ts`](../../../../apps/chat-back/src/models/host-integration.ts).
O documento de referência do contrato está em
[`docs/backend/HostIntegration.md`](../../../backend/HostIntegration.md).

O contrato é uma interface TypeScript interna. Ele não especifica endpoints
HTTP, payloads de rede, SDK, protocolo de autenticação serviço-a-serviço ou
detalhes de implantação. Esses aspectos serão definidos ao implementar o
adaptador concreto para o Host escolhido.

## Assinatura do contrato

```ts
interface HostIntegration {
  loadConversationContext(
    request: HostContextRequest,
  ): Promise<HostConversationContext>;

  executeTool(request: HostToolExecutionRequest): Promise<HostToolOutput>;
}
```

| Método                    | Entrada                    | Saída                     | Quando rejeita                                                        |
| ------------------------- | -------------------------- | ------------------------- | --------------------------------------------------------------------- |
| `loadConversationContext` | `HostContextRequest`       | `HostConversationContext` | identidade inválida, tenant não permitido, indisponibilidade, timeout |
| `executeTool`             | `HostToolExecutionRequest` | `HostToolOutput`          | não autorizado, ausente, argumentos recusados, indisponibilidade      |

As rejeições usam `HostIntegrationError`; nenhum dos métodos resolve com
sucesso vazio para representar falha. Ambos aceitam `signal?: AbortSignal`
opcional.

## Contrato de identidade

O Core valida o JWT OIDC e constrói `HostPrincipal` a partir da identidade
verificada:

```ts
export interface HostPrincipal {
  user_id: string;
  tenant_id?: string;
}
```

- `user_id` vem do subject (`sub`) do token validado.
- `tenant_id` é opcional e vem do claim de tenant configurado.
- O navegador não constrói nem escolhe esse principal.
- Headers, corpo da requisição, contexto fornecido pelo cliente e texto gerado
  pela IA não substituem a identidade validada.
- O adaptador usa autenticação serviço-a-serviço apropriada ao ambiente; seus
  segredos permanecem no backend.

## Carregamento de contexto e ferramentas

O Core solicita contexto por conversa:

```ts
export interface HostContextRequest {
  principal: HostPrincipal;
  conversation_id: string;
  signal?: AbortSignal;
}
```

O Host retorna contexto e ferramentas em uma única resposta:

```ts
export interface HostConversationContext {
  chat_context: ChatContext;
  tools: Tool[];
}
```

Retorná-los juntos vincula os grants e o catálogo ao mesmo principal e escopo.
`chat_context` segue o modelo
[`ChatContext`](../../../../apps/chat-back/src/models/chat-context.ts) e pode
conter dados do usuário, perfil, preferências, sessão, página, permissões e
contexto adicional. Devem ser incluídos somente dados necessários e
autorizados.

`permissions` representa grants confiáveis para aquele principal. Sua ausência
não concede acesso; o formato do código é `dominio.acao` (`PermissionCode`). O
Host publica somente ferramentas disponíveis naquele escopo; a lista pode ser
vazia. Cada [`Tool`](../../../../apps/chat-back/src/models/tool.ts) declara
nome, descrição, JSON Schema dos argumentos (`input_schema`) e permissões
exigidas (`required_permissions`).

## Execução de ferramentas

Quando o provider propuser uma chamada, o fluxo esperado no Core é:

1. localizar a ferramenta no catálogo obtido do Host;
2. verificar a correspondência do nome e autorizar com os grants confiáveis;
3. validar os argumentos pelo JSON Schema da ferramenta;
4. encaminhar ao adaptador somente chamadas autorizadas e válidas;
5. tratar o resultado ou a falha sem transformar erro em sucesso vazio.

O pedido ao Host contém o principal verificado e a chamada:

```ts
export interface HostToolExecutionRequest {
  principal: HostPrincipal;
  tool_call: ToolCall;
  signal?: AbortSignal;
}
```

O [`ToolCall`](../../../../apps/chat-back/src/models/tool-call.ts) contém `id`,
`tool_name`, `arguments` e `context.conversation_id`. O resultado tem tipo
recursivo compatível com JSON:

```ts
export type HostToolOutput =
  | string
  | number
  | boolean
  | null
  | HostToolOutput[]
  | { [key: string]: HostToolOutput };
```

O Host deve revalidar autorização e acesso ao recurso no instante da execução,
pois permissões recebidas no contexto não substituem a autorização na fonte do
dado. Chamadas inválidas ou sem autorização devem ser recusadas sem efeitos
colaterais.

### Idempotência

`tool_call.id` identifica a chamada e é a chave de idempotência: o Core reusa o
mesmo `id` em novas tentativas da mesma operação, e o Host pode deduplicar por
ele. O contrato não força idempotência; a garantia é do Host.

### Timeout e cancelamento

O `signal` opcional permite cancelar. O timeout é política do adaptador, por
configuração — não há valor fixo no contrato. Cancelar não desfaz efeito já
aplicado; o Core trata esse caso como resultado desconhecido.

### Retry

O Core não repete automaticamente ferramentas com efeito colateral. Repetição
é permitida apenas para leituras idempotentes, apenas em `timeout` e
`host_unavailable`, com o mesmo `tool_call.id` e dentro de um limite de
tentativas definido quando o adaptador existir.

## Taxonomia de erros

`HostIntegrationError` carrega `code`, `message` e `cause` opcional.
`message` não expõe credenciais nem dados fora do escopo; `cause` é diagnóstico
interno.

| Código              | Quando usar                                                  | Tratamento no Core                                           |
| ------------------- | ------------------------------------------------------------ | ------------------------------------------------------------ |
| `unauthorized`      | identidade ausente, inválida ou não reconhecida              | definitivo; não repetir                                      |
| `forbidden`         | sem escopo, tenant ou grant suficiente                       | definitivo; não repetir; registrar a recusa                  |
| `not_found`         | ferramenta ou recurso inexistente no escopo                  | definitivo; não repetir                                      |
| `invalid_arguments` | Host recusou argumentos na revalidação                       | definitivo; erro de chamada, não de infraestrutura           |
| `timeout`           | expirou ou foi cancelada por expiração                       | retentável só para leitura idempotente, mesmo `tool_call.id` |
| `host_unavailable`  | falha de comunicação ou erro transitório                     | retentável só para leitura idempotente, mesmo `tool_call.id` |
| `unknown`           | falha não classificada ou cancelamento sem código específico | falha; não repetir sem decisão explícita                     |

O formato de erro de cada Host real permanece fora do escopo; o adaptador faz a
tradução.

## Auditoria

Requisito documentado, não implementado nesta task. O Core deve registrar por
chamada:

- `user_id` e, quando houver, `tenant_id`;
- ferramenta e `conversation_id`;
- horário;
- resultado: sucesso ou código de erro.

Nunca registrar argumentos ou resultados completos, que podem conter dados
sensíveis, e nunca segredos, tokens ou headers de autenticação.

## Dados do Host não são confiáveis para o modelo

Contexto e resultados de ferramentas entram no prompt e podem conter texto
malicioso, incluindo prompt injection. Esse conteúdo é dado, não instrução com
autoridade: não amplia permissões, não altera grants e não substitui a validação
do Core. Vale a regra já existente de que o modelo não autoriza nada — a decisão
é dos grants do contexto e da revalidação do Host (Tasks 05–08).

## Detalhes do contrato

- **Tenant ausente:** se o Host exigir tenant e o principal não tiver
  `tenant_id`, o Core não deve chamar o Host; se chamar, o adaptador rejeita com
  `forbidden`.
- **Limites de tamanho:** devem existir para contexto e resultado e ser
  aplicados pelo Core; os números serão decididos com Tools e Segurança e não
  estão fixados no contrato.
- **Cache do contexto:** carregar por conversa/turno, não reutilizar entre
  usuários; grants podem mudar e a execução é sempre revalidada pelo Host.
- **Versão:** `HOST_INTEGRATION_CONTRACT_VERSION` versiona o contrato; mudança
  incompatível deve incrementá-la e o adaptador informa a versão ao Host.

## Fluxo e responsabilidades

```text
Cliente --JWT OIDC--> Core --principal verificado--> Adaptador do Host
                                                   <-- contexto + ferramentas
Core --mensagem e contexto autorizado--> provider de IA
Core --autorização + validação--> Adaptador do Host --operação--> Sistema Host
```

| Componente     | Responsabilidade                                                                                                                   |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Sistema Host   | Fornecer dados e grants no escopo autorizado, declarar ferramentas e executar operações de negócio com nova verificação de acesso. |
| Core           | Validar identidade, limitar os dados compartilhados, verificar permissões e argumentos, controlar chamadas e reportar falhas.      |
| Provider de IA | Processar a mensagem e, quando aplicável, propor chamadas; não autenticar, conceder grants ou acessar diretamente o Host.          |
| Adaptador      | Traduzir a interface interna para o mecanismo acordado com o Host, mantendo credenciais no backend e propagando erros.             |

## Decisões do contrato

- **Independente da IA:** a interface do Host não importa nem depende de
  interfaces dos providers.
- **Transporte desacoplado:** `HostIntegration` é uma porta interna; não
  pressupõe HTTP, chamadas locais ou um SDK específico.
- **Contexto e catálogo juntos:** grants e ferramentas vêm do mesmo carregamento
  de contexto e escopo.
- **Identidade confiável:** o principal é criado pelo Core após validar OIDC,
  nunca confiado ao cliente ou à IA.
- **Autorização em duas fronteiras:** o Core bloqueia chamadas sem grants e o
  Host verifica novamente o acesso real antes de produzir efeitos.
- **Falhas explícitas e tipadas:** erros de execução não viram sucesso vazio e
  são traduzidos para a taxonomia de `HostIntegrationError`.
- **Dados mínimos:** contexto e resultados não devem expor credenciais ou dados
  fora do escopo autorizado.

## Fora do escopo desta task

- Implementar ou escolher um protocolo de rede para o adaptador.
- Registrar um adaptador no módulo NestJS ou configurar credenciais de produção.
- Alterar endpoints públicos, autenticação OIDC ou variáveis da stack Docker.
- Carregar `ChatContext` e ferramentas no fluxo atual de mensagens.
- Conectar chamadas de ferramentas ao provider de IA ou executar ferramentas
  reais no Host.
- Definir o formato de erro específico de cada Host.
- Implementar auditoria, limites de tamanho, cache ou retry.

## Critérios de aceite

- [x] A identidade, o pedido de contexto, a resposta de contexto/ferramentas e o
      pedido de execução têm tipos explícitos.
- [x] A assinatura dos dois métodos do contrato está documentada, com entrada,
      saída e condições de rejeição.
- [x] O resultado da execução é limitado a valores JSON recursivos.
- [x] Existe taxonomia tipada de erros (`HostIntegrationError`) com os códigos
      definidos e orientação de tratamento.
- [x] Idempotência, timeout/cancelamento e regra de retry estão modelados nos
      tipos (chave `tool_call.id` e `signal`) e documentados.
- [x] O requisito de auditoria por chamada está documentado, incluindo a
      proibição de registrar argumentos/resultados completos e segredos.
- [x] Está documentado que contexto e saída do Host são não confiáveis para o
      modelo e não ampliam permissões.
- [x] Tenant ausente, limites de tamanho, cache do contexto e versão do contrato
      estão documentados.
- [x] Os modelos `ChatContext`, `Tool` e `ToolCall` estão linkados aos arquivos
      reais, e as Tasks 05–08 estão referenciadas por caminhos existentes.
- [x] O contrato descreve confiança, permissões, validação, execução e falhas.
- [x] A fronteira não escolhe provider de IA nem protocolo de transporte.
- [x] Adaptador em memória e testes de contrato existem somente em
      `apps/chat-back/test/`, sem registro no módulo NestJS.
- [x] O estado real de integração e as etapas posteriores estão documentados.

## Questões em aberto

Preencher com o time de Tools e Segurança e com o responsável pelo Host. Não há
respostas definidas nesta task.

| Questão                                          | Responsável | Resposta |
| ------------------------------------------------ | ----------- | -------- |
| Qual é o Host alvo e qual protocolo ele oferece? |             |          |
| Como será a autenticação serviço-a-serviço?      |             |          |
| Quais timeouts e retries são esperados?          |             |          |
| Qual é o formato de erro do Host real?           |             |          |
| Quem revisou/aprovou este contrato?              |             |          |

## Estado atual

O contrato está definido, tipado e coberto por testes de contrato com um
adaptador em memória restrito a `test/`. Ainda não há adaptador registrado no
Core. Atualmente, o fluxo de mensagens não carrega `ChatContext` nem catálogo de
ferramentas para o provider e não executa ferramentas do Host. Portanto, o
resultado desta task é a fronteira documentada e preparada para implementação
posterior, não uma integração Host funcional.

## Validação realizada

- `npx tsc --noEmit -p tsconfig.json` (src + test) — passou.
- `npx tsx --test test/models/host-integration.test.ts` — 8 testes passaram.
- `npx oxlint --type-aware` nos arquivos novos — sem findings.
- Verificação dos links relativos dos documentos.

## Divergência encontrada entre documentação e código

A documentação anterior afirmava que o `ToolCall` contém `conversation_id`
diretamente. O modelo real usa `context.conversation_id`. Os documentos foram
corrigidos para refletir o código.
