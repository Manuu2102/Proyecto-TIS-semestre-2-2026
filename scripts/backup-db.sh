#!/usr/bin/env bash
set -Eeuo pipefail

# Respaldo manual de PostgreSQL para el proyecto TIS.
# Requiere pg_dump y la variable de entorno DATABASE_URL.

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "Error: define DATABASE_URL antes de ejecutar el respaldo." >&2
  exit 1
fi

if ! command -v pg_dump >/dev/null 2>&1; then
  echo "Error: pg_dump no está instalado o no está en PATH." >&2
  exit 1
fi

BACKUP_DIR="${BACKUP_DIR:-backups}"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
BACKUP_FILE="${BACKUP_DIR}/tis_db_${TIMESTAMP}.dump"

mkdir -p "$BACKUP_DIR"

echo "Iniciando respaldo de PostgreSQL..."
if pg_dump \
  --dbname="$DATABASE_URL" \
  --format=custom \
  --no-owner \
  --no-acl \
  --file="$BACKUP_FILE"; then
  echo "Respaldo creado correctamente: $BACKUP_FILE"
else
  rm -f "$BACKUP_FILE"
  echo "Error: no se pudo completar el respaldo." >&2
  exit 1
fi