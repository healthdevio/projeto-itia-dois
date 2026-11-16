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

`chat_context` usa o modelo `ChatContext`: dados de usuário, perfil, sessão,
página, preferências e permissões podem ser fornecidos conforme disponíveis e
necessários. O Host deve minimizar dados pessoais e incluir somente informações
autorizadas e úteis à conversa. `permissions` contém grants confiáveis para
aquele principal; ausência de grant significa acesso negado. O Host nunca deve
derivar permissões de texto gerado pela IA nem de valores livres do cliente.

Cada `Tool` contém `name`, `description`, `input_schema` e
`required_permissions`. O Host publica apenas ferramentas disponíveis para o
principal naquele escopo. A lista pode ser vazia.

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
}
```

O `ToolCall` contém o identificador, o nome da ferramenta, os argumentos e o
`conversation_id`. O Host deve validar novamente acesso ao recurso e efeitos
permitidos no instante da execução. Chamadas inválidas ou não autorizadas devem
ser recusadas sem efeitos colaterais. `executeTool` resolve com
`HostToolOutput` (valor JSON recursivo) ou rejeita em caso de falha; erros não
devem ser convertidos em sucesso vazio.

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

Os tipos formalizam o contrato, mas ainda não existe adaptador registrado no
Core. O fluxo atual de mensagens não carrega `ChatContext` nem catálogo de
ferramentas para o provider e não executa ferramentas do Host. A implementação
dessas etapas é posterior; este contrato não altera endpoints, autenticação,
provider de IA ou configuração Docker.
