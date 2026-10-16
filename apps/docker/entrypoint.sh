#!/bin/sh
# Entrypoint do Core.
#
# Aplica as migrations e so entao sobe o servidor. No compose isso era um
# servico a parte (migrate-core, com restart: no, e o Core dependia do
# `service_completed_successfully`). No Swarm todo servico e perpetual: um
# container de migration sairia com o Swarm recriando-o em laco.
#
# O Swarm nao implementa depends_on, entao a espera pelo Postgres acontece aqui.
# Sem isso o Core sobe antes do banco e cai em loop de restart.

set -eu

: "${CORE_PORT:=3001}"

# A URL vem da stack com a senha embutida. Se vier por arquivo, troca o valor.
if [ -n "${POSTGRES_PASSWORD_FILE:-}" ] && [ -f "${POSTGRES_PASSWORD_FILE}" ]; then
  POSTGRES_PASSWORD="$(cat "${POSTGRES_PASSWORD_FILE}")"
  export POSTGRES_PASSWORD
  DATABASE_URL="$(echo "${DATABASE_URL:-}" | sed "s/:[^:@]*@/:${POSTGRES_PASSWORD}@/")"
  export DATABASE_URL
fi

if [ -n "${DATABASE_URL:-}" ]; then
  echo "[entrypoint] esperando o postgres"

  # Extrai host e porta do DATABASE_URL para o pg_isready. O nome do host e
  # "postgres", resolvido pelo Swarm na rede overlay.
  PG_HOST="$(echo "${DATABASE_URL}" | sed -E 's|.*@([^:/?]+).*|\1|')"
  PG_PORT="$(echo "${DATABASE_URL}" | sed -E 's|.*@[^:/?]+:([0-9]+).*|\1|')"
  PG_PORT="${PG_PORT:-5432}"

  ATTEMPTS=0
  until pg_isready -h "${PG_HOST}" -p "${PG_PORT}" -q; do
    ATTEMPTS=$((ATTEMPTS + 1))
    if [ "${ATTEMPTS}" -ge 30 ]; then
      echo "[entrypoint] postgres nao respondeu apos 30 tentativas" >&2
      exit 1
    fi
    sleep 2
  done

  echo "[entrypoint] postgres pronto"
else
  echo "[entrypoint] sem DATABASE_URL: pulando espera e migration"
fi

echo "[entrypoint] aplicando migrations"
node dist/db/migrate.js

echo "[entrypoint] iniciando o servidor na porta ${CORE_PORT}"
exec node dist/index.js