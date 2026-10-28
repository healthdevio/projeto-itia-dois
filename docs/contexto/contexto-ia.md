# Contexto do projeto

Resumo operacional do repositório, conferido com os arquivos versionados em 27 de outubro de 2026. Para detalhes de uso, siga os READMEs dos componentes e os documentos de CI/CD.

## Estrutura atual

| Caminho                   | Responsabilidade                                                  | Situação                                                                                                         |
| ------------------------- | ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `apps/chat-omnia`         | React, Vite e interface                                           | Usa estado local e resposta simulada; o transporte para a API ainda não está conectado.                          |
| `apps/chat-back`          | API Hono, PostgreSQL, Drizzle e testes                            | Backend atual; possui `/health`, `/health/ready` e `/health/live`.                                               |
| `apps/packages/knowledge` | Schema e migrations de conhecimento                               | Não integrado ao deploy principal.                                                                               |
| `apps/docker`             | Dockerfiles, nginx, compose local, stack Swarm e script de backup | Nomes de serviço, imagem e porta foram alinhados; o build e deploy ainda precisam ser executados para validação. |
| `.github/workflows`       | CI e publicação de imagens                                        | CI valida os apps e imagens; CD publica após CI aprovada e deixa atualização da stack manual no Portainer.       |

## Estado atual de CI/CD

O Dockerfile compila `apps/chat-back`, a stack e nginx usam o serviço `core`, e a imagem publicada chama-se `chat-core`. Node 24 está configurado na CI e nos Dockerfiles. O Postgres exige senha, tem health check e o serviço Core espera o banco antes de rodar migrations.

A CI verifica formatação sem escrever arquivos, constrói as imagens e bloqueia vulnerabilidades HIGH/CRITICAL corrigíveis. O CD executa após a CI aprovada em `main`, publica tags por SHA e mantém o deploy manual no Portainer. Ainda não foi validado por execução neste ambiente.

## Segurança e operação

- O backend valida JWT Bearer via JWKS e deriva a identidade do `sub`; headers `X-User-Id` e `X-Tenant-Id` enviados pelo cliente são ignorados. Configure OIDC e integre a UI com o provedor antes de liberar usuários reais.
- Uma credencial de banco aparece em documentação histórica. Se foi usada, rotacione-a e examine o histórico Git; não replique o valor em outros arquivos.
- O Postgres usa volume local com placement restrito no Swarm. O script de backup requer destino externo montado e chave pública age; a agenda precisa ser configurada no nó e restauração testada.
- A interface ainda não consome a API, então publicar imagens não significa que o chat esteja ponta a ponta integrado.

## Fluxos úteis

### CI local

```bash
npm run format:check
cd apps/chat-back
npm ci
npm run typecheck
npm test
npm run build
cd ../chat-omnia
npm ci
npm run typecheck
npm run lint
npm run build
```

### Arquivos principais

- CI: `.github/workflows/ci.yml`
- Publicação: `.github/workflows/cd.yml`
- Stack: `apps/docker/pw2c/docker-stack.yml`
- Proxy e arquivos estáticos: `apps/docker/nginx.conf`
- Backend: `apps/chat-back/src/index.ts`
- Visão geral da documentação: `docs/README.md`

## Regras para manter este documento

Atualize este resumo quando mudar a estrutura, os workflows, o modelo de deploy ou as limitações de segurança. Confirme cada afirmação no código e na configuração atual; não registre como operacional algo que só esteja planejado.
