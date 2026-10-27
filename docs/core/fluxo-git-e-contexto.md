# Fluxo de Git e contexto do projeto

Este documento resume convenções de contribuição e pontos de atenção atuais. Confirme nomes de branches e remotes no repositório antes de executar comandos de publicação.

## Fluxo de contribuição

O fluxo documentado pelo projeto usa branches de tarefa e Pull Requests. A CI roda em PRs para `develop` e `main`.

```bash
git checkout develop
git pull
git checkout -b feat/nome-da-tarefa
# ... alterações ...
git add <arquivos>
git commit -m "tipo: descrição"
git push -u origin feat/nome-da-tarefa
```

| Prefixo  | Uso                 |
| -------- | ------------------- |
| `feat:`  | Nova funcionalidade |
| `fix:`   | Correção            |
| `docs:`  | Documentação        |
| `chore:` | Manutenção          |

## Arquitetura atual

- Backend: `apps/chat-back`, API Hono em TypeScript.
- Frontend: `apps/chat-omnia`, React e Vite; ainda não conectado ao transporte da API.
- Banco: PostgreSQL; o pacote `knowledge` não está integrado ao fluxo principal.
- Deploy: stack Docker Swarm em `apps/docker/pw2c/docker-stack.yml` e publicação pelo GitHub Actions.

## Health checks

- `GET /health`: estado geral e conectividade com o banco.
- `GET /health/ready`: responde 200 se o banco está disponível e 503 caso contrário.
- `GET /health/live`: indica que o processo está vivo.

As rotas estão em `apps/chat-back/src/index.ts`. O nginx proxy `/health` para o backend.

## Bloqueios de deploy conhecidos

- Dockerfile, workflow, stack e nginx foram alinhados em torno de `apps/chat-back`, imagem `chat-core` e serviço `core`; valide o build e a resolução no Swarm antes do deploy.
- O CD publica após CI aprovada e deixa atualização da stack manual no Portainer.
- A identidade agora vem do `sub` de um JWT Bearer verificado. Configure OIDC e integre a UI antes de liberar usuários reais.

## Credenciais

Este documento não armazena valores de secrets. Configure senhas e tokens apenas nos gestores apropriados. Uma credencial de banco apareceu em versão anterior deste arquivo; se foi utilizada, rotacione-a e verifique o histórico Git.

## Documentos relacionados

- [Contexto atual](../contexto/contexto-ia.md)
- [CI/CD](../ci_cd/README.md)
- [Health checks](health-check-core.md)
