#!/bin/sh

set -eu
umask 077

: "${BACKUP_DIR:?Set BACKUP_DIR to a mounted external backup location}"
: "${AGE_RECIPIENT:?Set AGE_RECIPIENT to the age public key for encryption}"
: "${POSTGRES_SERVICE:=omnia_postgres}"
: "${RETENTION_DAYS:=30}"

command -v docker >/dev/null 2>&1 || {
  echo "docker is required" >&2
  exit 1
}
command -v age >/dev/null 2>&1 || {
  echo "age is required" >&2
  exit 1
}
mountpoint -q "$BACKUP_DIR" || {
  echo "BACKUP_DIR must be a mounted external filesystem" >&2
  exit 1
}

container_id="$(docker ps \
  --filter "label=com.docker.swarm.service.name=${POSTGRES_SERVICE}" \
  --format '{{.ID}}' | sed -n '1p')"

if [ -z "$container_id" ]; then
  echo "No running task found for ${POSTGRES_SERVICE}; run this on the Postgres node" >&2
  exit 1
fi

mkdir -p "$BACKUP_DIR"
timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
backup_file="${BACKUP_DIR%/}/omnia-postgres-${timestamp}.dump.age"
temporary_file="${backup_file}.tmp"
trap 'rm -f "$temporary_file"' EXIT HUP INT TERM

docker exec "$container_id" sh -c \
  'pg_dump --username="$POSTGRES_USER" --dbname="$POSTGRES_DB" --format=custom' \
  | age --encrypt --recipient "$AGE_RECIPIENT" --output "$temporary_file"

mv "$temporary_file" "$backup_file"
find "$BACKUP_DIR" -type f -name 'omnia-postgres-*.dump.age' \
  -mtime "+${RETENTION_DAYS}" -delete

echo "Encrypted backup created: $backup_file"
