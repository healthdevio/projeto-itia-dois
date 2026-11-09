# Publicação de imagens

O workflow `.github/workflows/cd.yml` inicia após CI aprovada em `main`. Ele faz checkout do mesmo SHA, autentica no registry PW2C, constrói e publica backend e frontend, e registra as tags imutáveis no resumo do GitHub Actions.

## Imagens configuradas no workflow

| Imagem      | Dockerfile                    | Tags                                     |
| ----------- | ----------------------------- | ---------------------------------------- |
| `chat-core` | `apps/docker/Dockerfile.core` | `latest`, SHA do commit e nome da branch |
| `chat-web`  | `apps/docker/Dockerfile.web`  | `latest`, SHA do commit e nome da branch |

## Bloqueio conhecido

`Dockerfile.core` compila `apps/chat-back`; a imagem `chat-core` corresponde à stack Swarm e é construída e escaneada pelo CI antes da publicação.

## Deploy

Após publicação, o job de deploy aciona os webhooks individuais dos serviços `core` e `web` no Portainer quando `DEPLOY_ENABLED=true`. Como a stack normalmente usa `latest`, os serviços puxam as imagens recém-publicadas e reiniciam. O workflow não atualiza o conteúdo/configuração da stack; mudanças nessa configuração e rollbacks para tags SHA continuam manuais no Portainer.

## Próximas melhorias

- Preferir digest ou tag imutável por SHA no serviço implantado, em vez de depender apenas de `latest`.
- Validar o primeiro deploy após mudanças de configuração da stack e testar o procedimento de rollback.
