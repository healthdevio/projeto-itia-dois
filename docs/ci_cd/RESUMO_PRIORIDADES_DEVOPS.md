# Relatório das melhorias DevOps

Revisão e alterações realizadas em 27 de outubro de 2026. Nenhum deploy ou teste foi executado nesta tarefa.

> **Registro histórico:** este relatório descreve o estado e as decisões daquela revisão. O deploy passou a acionar webhooks do Portainer quando `DEPLOY_ENABLED=true`, e a varredura Trivy ocorre no CD atual. Consulte [visão geral da CI/CD](visao-geral.md) e [ativação e operação](ativacao-e-operacao.md) para o fluxo vigente.

## P0 — Build, stack e configuração

- `Dockerfile.core` agora compila `apps/chat-back`, usa Node 24 em todas as etapas, serve na porta 80 e verifica `/health/live`.
- A stack agora usa o serviço `core` e a imagem `chat-core`, alinhados com nginx e CD.
- Corrigi o banco padrão para `omnia`, removi a senha padrão do arquivo de stack e tornei `POSTGRES_PASSWORD` obrigatória.
- Atualizei `.dockerignore` e `.prettierignore` para ignorar o harness no caminho atual `apps/chat-back/local`.
- Adicionei health check PostgreSQL com `pg_isready`. Removi `depends_on` do web porque o Swarm não o usa para ordenar serviços.
- Criei `apps/docker/pw2c/stack.env.example` com senha vazia e nomes de variáveis esperados.
- Atualizei o README raiz para usar `apps/chat-back` e descrever o fluxo de publicação atual.

## P0 — Credencial exposta

Removi o valor em claro dos arquivos atuais e procurei a ocorrência no histórico Git. A busca encontrou referências em **cinco commits**. O valor não é repetido neste relatório.

Se a senha foi usada, ainda é necessário rotacioná-la no Postgres e nos ambientes que a guardam. **Não reescrevi o histórico Git**: isso altera hashes de commits compartilhados e exige coordenação com quem usa o repositório.

## P1 — CI e publicação do commit aprovado

- A CI usa `npm run format:check` sem reformatar o checkout e aponta o cache npm do frontend para o lockfile correto.
- Padronizei os Dockerfiles em Node 24, mesma versão configurada na CI.
- O CD agora começa somente após a CI terminar com sucesso em `main`, faz checkout do `head_sha` aprovado e publica tags SHA, branch e `latest`.
- Ativei SBOM e provenance nas imagens publicadas e adicionei varredura Trivy para vulnerabilidades HIGH/CRITICAL corrigíveis nas imagens de CI.
- O deploy no Portainer continua manual: o resumo do CD informa as tags SHA exatas para aplicar. Isso preserva revisão operacional enquanto o cluster é validado.

O uso de `workflow_run` e da condição de sucesso segue o mecanismo documentado pelo [GitHub Actions](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#workflow_run). O `docker/build-push-action` documenta os inputs de [SBOM e provenance](https://github.com/docker/build-push-action/).

Como `workflow_run` pode acessar secrets, configure proteção de branch em `main` com PR obrigatório, revisão e CI exigida. Essa configuração é feita nas regras do repositório GitHub e não está versionada aqui. O [GitHub alerta sobre o uso de código não confiável nesse evento](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#workflow_run).

## P1 — Backup do Postgres

Adicionei `apps/docker/backup-postgres.sh`. Ele cria dump custom, criptografa com age, exige destino montado fora do nó, aplica retenção de 30 dias e falha se não encontrar a task do Postgres.

O procedimento em `docs/ci_cd/operacao.md` sugere backup diário às 02:00 UTC e teste mensal de restauração em banco isolado. **O cron não foi instalado**: ainda é preciso definir e montar o destino externo, provisionar a chave age e instalar a agenda no nó do banco. O RPO de 24 horas é uma proposta derivada da frequência diária; o RTO depende do responsável pelo serviço.

As opções documentadas são NAS/NFS separado, armazenamento de objetos compatível com S3 (exige etapa de upload adicional) ou migrar para Postgres gerenciado. Para esta stack, recomendo começar com NAS/NFS se a organização já opera um; caso contrário, avaliar bucket S3 privado.

## P1 — Autenticação da API

- Troquei a identidade confiada em `X-User-Id` por JWT Bearer verificado com `jose`: assinatura via JWKS, issuer, audience, expiração e algoritmo RS256/ES256. O `sub` validado define o usuário; claims de tenant vêm de `OIDC_TENANT_CLAIM` (padrão `tenant_id`). Headers de identidade do cliente são ignorados.
- A stack e os exemplos agora aceitam `OIDC_ISSUER`, `OIDC_AUDIENCE`, `OIDC_JWKS_URL`, `OIDC_TENANT_CLAIM` e `CORS_ORIGINS`. Sem configuração/token válido, rotas protegidas respondem `401` (fail closed).
- A integração ainda não pode ser ativada de ponta a ponta: falta informar o provedor, issuer, audience, JWKS URL e origem do frontend. A UI também ainda não obtém nem envia tokens.

## P2 — Dependências e cadeia de suprimentos

- Adicionei `.github/dependabot.yml` para manifests npm do monorepo, o ecossistema Docker em `apps/docker` e GitHub Actions. Os Dockerfiles com sufixo (`Dockerfile.core`, `.web`, `.knowledge`) podem exigir acompanhamento adicional, pois o arquivo Docker padrão da pasta é o que está configurado diretamente.
- SBOM, provenance e varredura de vulnerabilidades foram habilitados conforme descrito acima.
- Ainda não configurei alertas externos de disponibilidade, uso de disco, banco degradado ou falhas de backup. O repositório não identifica um sistema de monitoramento nem destinos de notificação.

## Mudanças que exigem decisão de produto/segurança

Não migrei a senha do banco e a chave NVIDIA para Docker Secrets. O backend consome `DATABASE_URL` e `NVIDIA_API_KEY` como variáveis de ambiente; a migração precisa contemplar leitura de secrets sem quebrar o processo de inicialização.

Antes dessas mudanças, decidir:

1. Qual provedor OIDC será usado e quais são issuer, audience, JWKS URL e origem do frontend.
2. Qual armazenamento externo receberá os backups e quem custodiará a chave privada age.
3. Se haverá rotação/revogação da credencial exposta e reescrita coordenada do histórico Git.
4. Qual ferramenta enviará alertas e quem ficará responsável pela operação.

## Limitações de validação

`npm run typecheck` no backend, `npm run format:check` na raiz e `git diff --check` passaram. Não executei a suíte de testes, build Docker, validação da stack no Swarm, workflow do GitHub ou chamada ao Portainer. O próximo passo é integrar a UI ao IdP escolhido, rodar a CI em branch/PR, conferir o build das imagens e aplicar primeiro em ambiente de validação antes de atualizar produção.
