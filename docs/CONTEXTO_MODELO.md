# Contexto do projeto para assistentes de IA

Use este documento como contexto inicial ao trabalhar neste repositório. Ele resume a arquitetura, as convenções e os riscos conhecidos. **O código e os arquivos de configuração são a fonte da verdade**: confira-os quando uma alteração puder ter mudado este resumo.

Atualizado em 27 de outubro de 2026.

## Como trabalhar neste repositório

1. Leia `README.md` e os documentos relevantes em `docs/` antes de alterar a implementação.
2. Confira `git status` antes de editar. Preserve alterações locais e arquivos não rastreados que já existiam.
3. Faça mudanças pequenas e relacionadas ao pedido. Não renomeie arquivos ou mude a arquitetura sem necessidade.
4. Não altere `apps/chat-omnia` sem autorização explícita do usuário; alterações no backend e na infraestrutura podem ser feitas quando necessárias ao pedido.
5. Não faça commit, push, merge, deploy ou comunicação externa sem autorização explícita.
6. Não afirme que testes, builds ou deploys passaram sem realmente executá-los. Execute testes ou verificações quando o usuário pedir ou quando forem parte necessária da tarefa autorizada.
7. Atualize a documentação junto com mudanças de comportamento, pipeline ou operação.
8. Não coloque credenciais em código, documentação, logs ou exemplos. Use valores fictícios ou placeholders.

## Visão do sistema

| Caminho                   | Responsabilidade                                                            | Estado conhecido                                                                                       |
| ------------------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `apps/chat-omnia`         | React, Vite, Tailwind e interface do chat                                   | Ainda usa estado/resposta local; o transporte HTTP/SSE não está conectado ao backend.                  |
| `apps/chat-back`          | API NestJS, TypeScript, Drizzle, PostgreSQL e integração com provider de IA | Backend atual; inclui testes e rotas de health check.                                                  |
| `apps/packages/knowledge` | Schema e migrations de conhecimento                                         | Ainda não integrado ao fluxo principal.                                                                |
| `apps/docker`             | Dockerfiles, nginx, compose local, stack Swarm e scripts operacionais       | Configuração alinhada nesta revisão; mudanças devem manter os nomes de serviço e imagem sincronizados. |
| `.github/workflows`       | CI e publicação das imagens                                                 | CD publica somente após CI de `main` passar; a atualização da stack segue manual no Portainer.         |

### Caminho de uma requisição

Em produção, o desenho esperado é navegador → nginx → backend → PostgreSQL/provider de IA. O nginx encaminha `/api` para o serviço `core` na porta 80. A interface local ainda não está conectada a esse fluxo.

### Identidade e segurança

O backend exige JWT Bearer e verifica assinatura, issuer, audience e expiração via JWKS. A identidade vem do claim `sub`; os headers `X-User-Id` e `X-Tenant-Id` enviados pelo cliente são ignorados. Configure `OIDC_ISSUER`, `OIDC_AUDIENCE` e `OIDC_JWKS_URL` antes de liberar usuários. A UI ainda não está integrada a um provedor e não envia tokens.

Credenciais de banco, registry, Portainer e provider de IA devem ficar em secrets do ambiente. Uma credencial de banco apareceu em documentação anterior; se foi usada, rotacione-a e avalie a remoção segura do histórico Git com o responsável pelo repositório.

## Estrutura relevante

```text
apps/chat-omnia/                 interface React/Vite
apps/chat-back/                  API NestJS e persistência
apps/packages/knowledge/         schema/migrations não integrado
apps/docker/Dockerfile.core      imagem da API
apps/docker/Dockerfile.web       imagem da interface/nginx
apps/docker/entrypoint.sh        espera PostgreSQL, migra e inicia API
apps/docker/pw2c/docker-stack.yml stack Docker Swarm
apps/docker/backup-postgres.sh   backup criptografado do Postgres
.github/workflows/ci.yml         validação
.github/workflows/cd.yml         publicação após CI aprovada
```

## CI/CD e convenções de release

- CI roda em PRs e pushes para `develop` e `main`.
- A CI valida frontend e backend, executa testes do backend, verifica Prettier sem alterar arquivos e constrói as imagens.
- O CD é iniciado pela conclusão bem-sucedida da CI em `main` e publica as imagens `chat-core` e `chat-web` com tags por SHA e branch.
- A stack usa os serviços `postgres`, `core` e `web`, na rede overlay `omnia_net`.
- A imagem do backend roda na porta 80 internamente; somente a porta pública da interface é publicada.
- O Postgres fica preso ao nó `compute01` porque seu volume é local. A perda do nó exige restauração de backup.
- O CD não atualiza automaticamente a stack. Aplique manualmente no Portainer as tags SHA publicadas depois de revisar o commit.
- Proteja `main` com Pull Request, revisão e CI exigida: o workflow de publicação usa `workflow_run` e acessa as credenciais do registry.

Não use tags móveis como única referência de rollback. Preserve o SHA exato que foi aprovado e publicado.

## Comandos de desenvolvimento

```bash
# Backend
cd apps/chat-back
npm ci
npm run dev
npm run typecheck
npm test
npm run build

# Interface
cd ../chat-omnia
npm ci
npm run dev
npm run typecheck
npm run lint
npm run build

# Prettier da raiz do repositório
cd ../..
npm ci
npm run format:check
```

Para operação Docker e backup, leia `docs/ci_cd/operacao.md` e `docs/estrutura/docker.md`. O script de backup deve rodar no nó do Postgres com um filesystem externo montado e uma chave pública age configurada.

## Documentos de referência

- `README.md`: visão geral, início rápido e limitações do produto.
- `docs/README.md`: índice dos documentos.
- `apps/chat-back/README.md`: contratos e comandos da API.
- `docs/core/`: contratos de conversa, mensagem, configuração e sugestões.
- `docs/ci_cd/`: pipeline, publicação, operação e diagnóstico.
- `docs/estrutura/`: CI, Docker, ambientes e testes.
- `docs/interface/`: componentes e estado da interface.
- `docs/PROCESSO_MIGRACAO.md` e `docs/changelog/`: registros históricos; não os trate como descrição automática do estado atual.

## Limites e decisões

Antes de fazer uma mudança que altere contratos de API, autenticação, comportamento do frontend, dados persistidos, compatibilidade de migrations ou disponibilidade de produção, explique o impacto e peça a decisão do usuário quando a intenção não estiver explícita. Para alterações reversíveis e dentro do escopo pedido, avance sem interromper o trabalho por escolhas rotineiras.

Não remova históricos nem reescreva o histórico Git sem autorização específica. Em caso de conflito entre este resumo e o repositório, atualize este documento após confirmar o comportamento real.
