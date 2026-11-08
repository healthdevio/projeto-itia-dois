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

O workflow atual **não atualiza a stack**. Após a publicação, o resumo instrui uma atualização manual no Portainer. A API do Portainer descrita em versões anteriores da documentação não está implementada no `cd.yml` atual.

## Próximas melhorias

- Fazer o deploy depender do sucesso da CI para o mesmo commit.
- Preferir digest ou tag imutável por SHA no serviço implantado.
- Gerar SBOM e fazer varredura de vulnerabilidades antes da publicação.
- Automatizar atualização da stack somente após corrigir as incompatibilidades e validar rollback.
