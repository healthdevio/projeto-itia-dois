# Integração com Host — Task 01: Definir o contrato

## Objetivo

Definir a fronteira entre o Core da Omnia IA e o Sistema Host. O contrato
estabelece como o Core solicita o contexto de uma conversa, recebe as
ferramentas disponíveis e encaminha a execução de uma ferramenta, sem acoplar
essa integração a um provider ou modelo específico de IA.

## Contexto e dependências

O Host é a fonte de contexto e de permissões de negócio; o Core autentica a
identidade, valida chamadas e controla o fluxo; o provider de IA interpreta a
mensagem e pode propor chamadas de ferramenta, mas não autentica o usuário,
concede permissões ou executa operações no Host.

Esta task depende das Tasks 05–08 de [Tools e Segurança](../../tools-e-seguranca/):

- **Task 05 — Estrutura de permissões:** define permissões exigidas por
  ferramentas e grants disponíveis no contexto.
- **Task 06 — Autorização:** define a decisão de autorização no Core.
- **Task 07 — Bloqueio:** impede chamadas não autorizadas.
- **Task 08 — Execução autorizada:** valida argumentos e só então permite
  encaminhar a chamada a um executor.

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
`chat_context` segue o modelo `ChatContext` e pode conter dados do usuário,
perfil, preferências, sessão, página, permissões e contexto adicional. Devem
ser incluídos somente dados necessários e autorizados.

`permissions` representa grants confiáveis para aquele principal. Sua ausência
não concede acesso. O Host publica somente ferramentas disponíveis naquele
escopo; a lista pode ser vazia. Cada `Tool` declara nome, descrição, JSON Schema
dos argumentos e permissões exigidas.

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
}
```

O `ToolCall` inclui identificador, nome, argumentos e `conversation_id`. O
resultado tem tipo recursivo compatível com JSON:

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
colaterais. Falhas do adaptador devem rejeitar a operação e ser tratadas como
falha pelo Core.

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
- **Falhas explícitas:** erros de execução não são convertidos em respostas
  vazias que pareçam sucesso.
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

## Critérios de aceite

- [x] A identidade, o pedido de contexto, a resposta de contexto/ferramentas e o
      pedido de execução têm tipos explícitos.
- [x] O resultado da execução é limitado a valores JSON recursivos.
- [x] O contrato descreve confiança, permissões, validação, execução e falhas.
- [x] A fronteira não escolhe provider de IA nem protocolo de transporte.
- [x] O estado real de integração e as etapas posteriores estão documentados.

## Estado atual

O contrato está definido e tipado em `host-integration.ts`. Ainda não há
adaptador registrado no Core. Atualmente, o fluxo de mensagens não carrega
`ChatContext` nem catálogo de ferramentas para o provider e não executa
ferramentas do Host. Portanto, o resultado desta task é a fronteira documentada
e preparada para implementação posterior, não uma integração Host funcional.

## Validação realizada

- Typecheck isolado do arquivo do contrato.
- Lint isolado do arquivo do contrato.
- Verificação dos links relativos no índice de documentação do backend.

A validação global do backend não faz parte do aceite isolado desta task.
