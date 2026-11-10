# Pré-requisitos para deploy

Este checklist reflete o repositório atual. Ele não confirma a existência ou o estado operacional do cluster.

## Verificações antes do deploy

- Conferir que o Dockerfile do backend, a imagem `chat-core`, o serviço `core` e o upstream nginx continuam alinhados.
- Confirmar que a CI aprovou o commit SHA que será publicado.
- Conferir que os secrets do registry permitem publicação e pull pelo Swarm.
- Definir no Portainer as variáveis indicadas em [`stack.env.example`](../../apps/docker/pw2c/stack.env.example). Preencha `POSTGRES_PASSWORD` com uma senha forte fora do Git.
- Configurar `DEPLOY_ENABLED=true` somente após cadastrar e validar os secrets `PORTAINER_WEBHOOK_CORE` e `PORTAINER_WEBHOOK_WEB` no environment `production`. O CD aciona esses webhooks após publicar as imagens.
- A stack precisa usar `latest` para que o webhook redeploye automaticamente a imagem recém-publicada. Atualizações da configuração da stack ou uso de tags SHA continuam exigindo ação manual no Portainer.

## Antes de aplicar a stack

- Confirmar os nós e constraints com `docker node ls`.
- Confirmar que o nó que armazena o volume do Postgres está definido e protegido por backup externo.
- Configurar as variáveis de ambiente necessárias no Portainer sem versionar valores secretos.
- Configurar credenciais do registry para que os nós consigam baixar as imagens privadas.
- Validar as imagens publicadas e os nomes dos serviços antes de atualizar a stack.
- Configurar `OIDC_ISSUER`, `OIDC_AUDIENCE` e `OIDC_JWKS_URL` antes de liberar usuários reais; sem isso, endpoints protegidos retornam `401`.

## Dados persistentes

O Postgres usa volume local no Swarm. A constraint atual aponta para `compute01`; se esse nó mudar ou ficar indisponível, o volume não acompanha automaticamente o serviço. Configure backup fora do nó e teste uma restauração antes de considerar o banco protegido.

## Variáveis

O template `apps/docker/pw2c/stack.env.example` contém nomes e valores não secretos, com senha vazia para impedir cópia acidental de uma senha padrão. Nunca inclua valores reais de `POSTGRES_PASSWORD`, tokens do registry, token do Portainer ou `NVIDIA_API_KEY` no Git.
