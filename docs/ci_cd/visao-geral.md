# Visão geral da CI/CD

Resumo dos workflows versionados em `.github/workflows/ci.yml` e `cd.yml`.

## Fluxo atual

```text
pull request/push em develop ou main -> CI
CI concluída com sucesso em main -> CD
CD -> build e publicação de imagens por SHA
após publicação -> atualização manual da stack no Portainer
```

O CD usa `workflow_run`, faz checkout do mesmo commit aprovado pela CI e só continua quando a conclusão é `success`. A atualização do Portainer permanece manual.

## CI

O workflow valida o frontend `apps/chat-omnia`, backend `apps/chat-back`, formatação Prettier, build das imagens e vulnerabilidades HIGH/CRITICAL corrigíveis nas imagens. A CI usa Node 24; os Dockerfiles Node também usam Node 24.

## CD

O CD publica as imagens `chat-core` e `chat-web`, com tags `latest`, branch e SHA. O SHA identifica a versão exata para a atualização manual e rollback. As imagens publicadas incluem SBOM e provenance.

O job **não** atualiza automaticamente a stack. O resumo no GitHub Actions informa as tags imutáveis a aplicar em Portainer.

## Nomes alinhados

| Papel                 | Caminho/nome                  |
| --------------------- | ----------------------------- |
| Código do backend     | `apps/chat-back`              |
| Dockerfile do backend | `apps/docker/Dockerfile.core` |
| Imagem do backend     | `chat-core`                   |
| Serviço interno       | `core`                        |
| Upstream nginx        | `core:80`                     |
| Banco PostgreSQL      | `omnia`                       |

O workflow e os Dockerfiles foram atualizados; valide a execução da CI e o primeiro deploy em ambiente controlado antes de considerar o fluxo operacional.
