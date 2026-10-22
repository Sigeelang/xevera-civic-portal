#!/usr/bin/env bash
set -euo pipefail
umask 077

APP_DIR="${XEVERA_APP_DIR:-/var/www/xevera}"
ENV_FILE="${XEVERA_ENV_FILE:-$APP_DIR/backend/.env}"
BUCKET="${XEVERA_BACKUP_BUCKET:-xevera-db-backups}"
PREFIX="${XEVERA_BACKUP_PREFIX:-daily}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
WORKDIR="$(mktemp -d /tmp/xevera-db-backup.XXXXXX)"
trap 'rm -rf "$WORKDIR"' EXIT

if [[ ! -r "$ENV_FILE" ]]; then
  echo "Database environment file not found: $ENV_FILE" >&2
  exit 1
fi

read_env() {
  local key="$1"
  local line value
  line="$(grep -E "^[[:space:]]*(export[[:space:]]+)?${key}=" "$ENV_FILE" | tail -n 1 || true)"
  value="${line#*=}"
  value="${value%$'\r'}"
  if [[ "$value" == \"*\" && "$value" == *\" ]]; then
    value="${value:1:${#value}-2}"
  elif [[ "$value" == \'*\' && "$value" == *\' ]]; then
    value="${value:1:${#value}-2}"
  fi
  printf '%s' "$value"
}

DB_NAME="$(read_env DB_NAME)"
DB_USER="$(read_env DB_USER)"
DB_PASS="$(read_env DB_PASS)"
DB_HOST="$(read_env DB_HOST)"
DB_PORT="$(read_env DB_PORT)"
: "${DB_NAME:?DB_NAME is missing from $ENV_FILE}"
: "${DB_USER:?DB_USER is missing from $ENV_FILE}"
: "${DB_PASS:?DB_PASS is missing from $ENV_FILE}"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-3306}"

[[ "$DB_NAME" =~ ^[A-Za-z0-9_-]+$ ]] || {
  echo "Unsafe DB_NAME: $DB_NAME" >&2
  exit 1
}

DUMP_NAME="${DB_NAME}-${STAMP}.sql.gz"
DUMP="$WORKDIR/$DUMP_NAME"
CHECKSUM="$DUMP.sha256"
KEY="$PREFIX/$DUMP_NAME"

MYSQL_ARGS=(
  --host="$DB_HOST"
  --port="$DB_PORT"
  --user="$DB_USER"
  --single-transaction
  --quick
  --routines
  --triggers
  --no-tablespaces
  --default-character-set=utf8mb4
)
if [[ "$DB_HOST" != "127.0.0.1" && "$DB_HOST" != "localhost" && "$DB_HOST" != "::1" ]]; then
  MYSQL_ARGS=(--protocol=tcp "${MYSQL_ARGS[@]}")
fi

export MYSQL_PWD="$DB_PASS"
mysqldump "${MYSQL_ARGS[@]}" "$DB_NAME" | gzip -9 > "$DUMP"
unset MYSQL_PWD

(
  cd "$WORKDIR"
  sha256sum "$DUMP_NAME" > "$DUMP_NAME.sha256"
)

aws s3 cp "$DUMP" "s3://$BUCKET/$KEY" --sse AES256 --only-show-errors --no-progress
aws s3 cp "$CHECKSUM" "s3://$BUCKET/$KEY.sha256" --sse AES256 --only-show-errors --no-progress

OBJECT_SIZE="$(aws s3api head-object --bucket "$BUCKET" --key "$KEY" --query ContentLength --output text)"
echo "Backup uploaded: s3://$BUCKET/$KEY ($OBJECT_SIZE bytes)"
