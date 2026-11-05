#!/bin/sh

set -eu

: "${CORE_PORT:=3001}"

if [ -n "${DATABASE_URL:-}" ]; then
  echo "[entrypoint] esperando o postgres"

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
fi

echo "[entrypoint] aplicando migrations"
node dist/db/migrate.js

echo "[entrypoint] iniciando o servidor na porta ${CORE_PORT}"
exec node dist/main.js