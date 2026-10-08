# Sequência até o CD funcionar

O `cd.yml` só publica imagens depois de chegar na `main`. Nenhuma etapa pode ser
pulada, e a ordem importa.

```
[1] revogar tokens          você     github.com/settings/tokens
[2] relogar na VM           você     docker login ghcr.io
[3] merge → develop         você     feat/cd-publish
[4] merge → main            você     develop
[5] rodar o CD              você     aba Actions, botão Run workflow
[6] conferir as imagens     você     ghcr.io/healthdevio
```

Até o passo 4, o `cd.yml` está **inerte**: sem erro, sem aviso, simplesmente não
dispara. A regra é do GitHub — `workflow_run` e `workflow_dispatch` só enxergam
workflows que existem na branch padrão, que aqui é `main`.

## Depois do passo 5

```
develop ──> deploy em /srv/omnia/homolog  (environment: homolog)
main    ──> deploy em /srv/omnia/prod     (environment: production)
```

O deploy envia `docker-compose.deploy.yml` e `deploy.sh` do repositório para a VM
antes de rodar, então a cópia local nunca fica defasada.

## Se algo falhar

| Erro                                   | Onde                                     |
| -------------------------------------- | ---------------------------------------- |
| `cd.yml` não aparece na aba Actions    | ainda está na `develop`, sem `main`      |
| `manifest unknown` no `pull`           | login ok; a imagem não foi publicada     |
| `unauthorized` no `pull`               | login falhou, ou token revogado          |
| `required variable IMAGE_CORE missing` | bug no `cd.yml`, não na VM               |
| `getaddrinfo ENOTFOUND postgres`       | `omnia-postgres` saiu da rede `omnia-db` |

Diagnóstico por sintoma em [deploy.md](deploy.md).
