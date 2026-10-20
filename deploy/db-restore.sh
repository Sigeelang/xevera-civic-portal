#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${XEVERA_APP_DIR:-/var/www/xevera}"
ENV_FILE="${XEVERA_ENV_FILE:-$APP_DIR/backend/.env}"
BUCKET="${XEVERA_BACKUP_BUCKET:-xevera-db-backups-347076820789}"
PREFIX="${XEVERA_BACKUP_PREFIX:-daily}"

usage() {
  echo "Usage: $0 --yes [s3-key]" >&2
  echo "Without s3-key, the newest backup under $PREFIX/ is restored." >&2
  echo "WARNING: this drops and recreates the database named in DB_NAME." >&2
}

if [[ "${1:-}" != "--yes" ]]; then
  usage
  exit 1
fi
shift
KEY="${1:-}"

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

if [[ -z "$KEY" ]]; then
  KEY="$(aws s3 ls "s3://$BUCKET/$PREFIX/" | awk '$4 ~ /\.sql\.gz$/ { print $4 }' | sort | tail -n 1)"
  if [[ -z "$KEY" ]]; then
    echo "No backups found under s3://$BUCKET/$PREFIX/" >&2
    exit 1
  fi
  KEY="$PREFIX/$KEY"
fi

WORKDIR="$(mktemp -d /tmp/xevera-db-restore.XXXXXX)"
trap 'rm -rf "$WORKDIR"' EXIT
DUMP_NAME="$(basename "$KEY")"
DUMP="$WORKDIR/$DUMP_NAME"

echo "Downloading s3://$BUCKET/$KEY"
aws s3 cp "s3://$BUCKET/$KEY" "$DUMP" --only-show-errors --no-progress
aws s3 cp "s3://$BUCKET/$KEY.sha256" "$WORKDIR/$DUMP_NAME.sha256" --only-show-errors --no-progress
(
  cd "$WORKDIR"
  sha256sum -c "$DUMP_NAME.sha256"
)

MYSQL_CMD=(
  mysql
  --host="$DB_HOST"
  --port="$DB_PORT"
  --user="$DB_USER"
  --default-character-set=utf8mb4
)
if [[ "$DB_HOST" == "localhost" || "$DB_HOST" == "127.0.0.1" ]] \
  && mysql --protocol=socket --batch --skip-column-names -e 'SELECT 1' >/dev/null 2>&1; then
  MYSQL_CMD=(mysql --protocol=socket --default-character-set=utf8mb4)
fi

if [[ "${MYSQL_CMD[1]:-}" == "--protocol=socket" ]]; then
  "${MYSQL_CMD[@]}" \
    -e "DROP DATABASE IF EXISTS \`$DB_NAME\`; CREATE DATABASE \`$DB_NAME\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
  gunzip -c "$DUMP" | "${MYSQL_CMD[@]}" "$DB_NAME"
else
  export MYSQL_PWD="$DB_PASS"
  "${MYSQL_CMD[@]}" \
    -e "DROP DATABASE IF EXISTS \`$DB_NAME\`; CREATE DATABASE \`$DB_NAME\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
  gunzip -c "$DUMP" | "${MYSQL_CMD[@]}" "$DB_NAME"
  unset MYSQL_PWD
fi

echo "Restore complete from s3://$BUCKET/$KEY"
