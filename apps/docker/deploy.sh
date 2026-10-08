#!/usr/bin/env bash
#
# Deploy de um ambiente. Assume, no diretório do ambiente:
#   - docker-compose.deploy.yml
#   - um .env fora do git, com POSTGRES_PASSWORD, NVIDIA_API_KEY e os secrets
#   - login no ghcr.io já feito (o workflow faz o docker login)
#
# A tag é escrita no .env em vez de vir por variável porque precisa sobreviver ao
# próximo deploy: o up -d sem --pull reusa o que está rodando, e passar a tag por
# -e deixaria o .env descrevendo uma versão que não é a no ar — o próximo up
# manual voltaria para a tag antiga sem ninguém perceber.
#
#   IMAGE_CORE=... IMAGE_WEB=... ./deploy.sh /srv/omnia/prod

set -euo pipefail

ENV_DIR="${1:?informe o diretório do ambiente}"
COMPOSE_FILE="docker-compose.deploy.yml"

if docker compose version >/dev/null 2>&1; then
  compose=(docker compose)
elif command -v docker-compose >/dev/null 2>&1; then
  compose=(docker-compose)
else
  echo "deploy: nem 'docker compose' nem 'docker-compose' encontrado" >&2
  exit 1
fi

cd "$ENV_DIR"

for file in "$COMPOSE_FILE" .env; do
  if [[ ! -f "$file" ]]; then
    echo "deploy: $ENV_DIR/$file não encontrado" >&2
    exit 1
  fi
done

# O banco (container omnia-postgres) é gerenciado pelo Portainer e vive na rede
# externa OMNIA_DB_NETWORK. Se a rede não existir, `up` falha com "network not
# found" — e a mensagem não diz que o problema é o Postgres de outro stack.
NETWORK="${OMNIA_DB_NETWORK:-omnia-db}"

if ! docker network inspect "$NETWORK" >/dev/null 2>&1; then
  echo "deploy: criando a rede externa $NETWORK"
  docker network create "$NETWORK" >/dev/null
fi

set_env() {
  local key="$1" value="$2"

  if grep -qE "^${key}=" .env; then
    # Delimitador |, para o valor não brigar com as barras da tag.
    sed -i -E "s|^${key}=.*|${key}=${value}|" .env
  else
    printf '%s=%s\n' "$key" "$value" >>.env
  fi
}

: "${IMAGE_CORE:?informe IMAGE_CORE}"
: "${IMAGE_WEB:?informe IMAGE_WEB}"

set_env IMAGE_CORE "$IMAGE_CORE"
set_env IMAGE_WEB "$IMAGE_WEB"

echo "deploy: aplicando"
"${compose[@]}" --env-file .env -f "$COMPOSE_FILE" pull

# Recria só o que mudou. A migration nova roda em migrate-core (restart: no), e
# o Core só sobe depois que ela termina.
"${compose[@]}" --env-file .env -f "$COMPOSE_FILE" up -d --remove-orphans

echo "deploy: estado"
"${compose[@]}" --env-file .env -f "$COMPOSE_FILE" ps
