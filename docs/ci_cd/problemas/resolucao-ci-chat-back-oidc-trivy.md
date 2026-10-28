# Resolução de falhas de CI do chat-back e imagens

Registro da correção aplicada no PR
[#64](https://github.com/healthdevio/projeto-itia-dois/pull/64), criado para
integrar em `develop`. O PR #63 promove `develop` para `main`; ele receberá essas
correções depois da integração do PR #64 em `develop`.

## Sintomas encontrados

O CI apresentou falhas em momentos diferentes:

- Os testes de rota recebiam `401` quando esperavam `400`.
- O workflow tentava carregar `microsoft/setup-node@v3`.
- O Prettier apontava `.github/workflows/ci.yml`.
- O job Docker não resolvia as referências da action do Trivy.
- Depois de corrigir as referências, o Trivy encontrou pacotes vulneráveis nas
  imagens do Core e da interface.

## Causas e correções

### Os testes usavam o contrato antigo de identidade

As rotas do Core verificam JWTs OIDC e obtêm a identidade do claim `sub`. Os
testes antigos enviavam somente `X-User-Id`; por isso o middleware respondia
`401` antes da validação do corpo.

Foi criado `apps/chat-back/test/helpers/identity.ts`, que inicia uma JWKS local
e gera tokens de teste assinados. Os testes de rota usam esses tokens para
alcançar a validação do corpo. Os casos sem token continuam verificando o
`401`.

### Action inexistente e formatação do workflow

O job já configurava Node.js com `actions/setup-node@v4`. O passo adicional
chamado “Configurar Autenticação OIDC” apontava incorretamente para
`microsoft/setup-node@v3`; ele foi removido. O arquivo `.github/workflows/ci.yml`
foi formatado com Prettier.

### Referências do Trivy

O workflow tinha duas referências a `aquasecurity/trivy-action@0.36.0`. A action
é distinta do binário Trivy; o log da execução mostrava o scanner `0.70.0`. As
duas referências foram fixadas no commit
`ed142fd0673e97e23eac54620cfb913e5ce36c25`, correspondente à release `v0.36.0`.

### Vulnerabilidades nas imagens

- A imagem final do Core incluía npm global, embora o serviço em execução só
  precise do Node.js. O Dockerfile remove npm, npx e os arquivos do npm da
  imagem final; a instalação de dependências continua ocorrendo nas etapas de
  build.
- A interface usava `nginx:1.27-alpine`, que trazia Alpine 3.21.3 e pacotes com
  vulnerabilidades corrigidas. A base foi atualizada para
  `nginx:1.30.6-alpine3.24`, seguida de `apk upgrade --no-cache` para instalar
  correções atuais dos pacotes Alpine.

O scanner permanece habilitado com severidade `HIGH,CRITICAL` e falha do job
quando encontra vulnerabilidades corrigíveis.

## Arquivos envolvidos

- `.github/workflows/ci.yml`
- `apps/chat-back/test/helpers/identity.ts`
- `apps/chat-back/test/routes/messages.test.ts`
- `apps/chat-back/test/routes/suggestions.test.ts`
- `apps/docker/Dockerfile.core`
- `apps/docker/Dockerfile.web`

## Validação

No ambiente local, passaram:

- `npm run format:check`
- `npm run typecheck` em `apps/chat-back`
- `npm test` em `apps/chat-back`: 95 testes aprovados

No [PR #64](https://github.com/healthdevio/projeto-itia-dois/pull/64), os jobs
de frontend, backend, formatação e imagens Docker passaram após as correções.
