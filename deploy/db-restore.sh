#!/usr/bin/env bash
set -euo pipefail
umask 077

APP_DIR="${XEVERA_APP_DIR:-/var/www/xevera}"
ENV_FILE="${XEVERA_ENV_FILE:-$APP_DIR/backend/.env}"
BUCKET="${XEVERA_BACKUP_BUCKET:-xevera-db-backups}"
PREFIX="${XEVERA_BACKUP_PREFIX:-daily}"
AWS_REGION="${AWS_REGION:-ap-southeast-1}"
ADMIN_SECRET="${XEVERA_DB_ADMIN_SECRET_ARN:-}"
ADMIN_USER="${XEVERA_DB_ADMIN_USER:-}"
ADMIN_PASS="${XEVERA_DB_ADMIN_PASS:-}"

usage() {
  cat >&2 <<EOF
Usage: $0 --yes [--admin-secret ARN] [s3-key]

Without s3-key, the newest backup under $PREFIX/ is restored.
WARNING: this drops and recreates the database named in DB_NAME.

For RDS, pass the master-user secret ARN:
  XEVERA_DB_ADMIN_SECRET_ARN=arn:aws:secretsmanager:... $0 --yes
or set XEVERA_DB_ADMIN_USER and XEVERA_DB_ADMIN_PASS.
EOF
}

if [[ "${1:-}" != "--yes" ]]; then
  usage
  exit 1
fi
shift

KEY=""
while (($#)); do
  case "$1" in
    --admin-secret)
      [[ $# -ge 2 ]] || { usage; exit 1; }
      ADMIN_SECRET="$2"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    -*)
      echo "Unknown option: $1" >&2
      usage
      exit 1
      ;;
    *)
      [[ -z "$KEY" ]] || { echo "Only one S3 key may be given" >&2; exit 1; }
      KEY="$1"
      shift
      ;;
  esac
done

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
[[ "$DB_USER" =~ ^[A-Za-z0-9_.-]+$ ]] || {
  echo "Unsafe DB_USER: $DB_USER" >&2
  exit 1
}

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

LOCAL_SOCKET=0
if [[ "$DB_HOST" == "localhost" || "$DB_HOST" == "127.0.0.1" || "$DB_HOST" == "::1" ]]; then
  if mysql --protocol=socket --batch --skip-column-names -e 'SELECT 1' >/dev/null 2>&1; then
    LOCAL_SOCKET=1
  fi
fi

if (( LOCAL_SOCKET )); then
  ADMIN_CMD=(mysql --protocol=socket --default-character-set=utf8mb4)
  ADMIN_PASS=""
  echo "Using local MariaDB root socket for restore"
else
  if [[ -z "$ADMIN_SECRET" && ( -z "$ADMIN_USER" || -z "$ADMIN_PASS" ) ]]; then
    echo "Remote restore needs admin credentials." >&2
    echo "Set XEVERA_DB_ADMIN_SECRET_ARN or XEVERA_DB_ADMIN_USER/XEVERA_DB_ADMIN_PASS." >&2
    exit 1
  fi

  if [[ -n "$ADMIN_SECRET" ]]; then
    command -v aws >/dev/null 2>&1 || { echo "aws CLI is required" >&2; exit 1; }
    command -v python3 >/dev/null 2>&1 || { echo "python3 is required" >&2; exit 1; }
    SECRET_JSON="$(aws secretsmanager get-secret-value \
      --secret-id "$ADMIN_SECRET" --region "$AWS_REGION" \
      --query SecretString --output text)"
    if [[ -z "$ADMIN_USER" ]]; then
      ADMIN_USER="$(printf '%s' "$SECRET_JSON" | python3 -c \
        'import json,sys; print(json.load(sys.stdin).get("username", ""))')"
    fi
    if [[ -z "$ADMIN_PASS" ]]; then
      ADMIN_PASS="$(printf '%s' "$SECRET_JSON" | python3 -c \
        'import json,sys; print(json.load(sys.stdin).get("password", ""))')"
    fi
    unset SECRET_JSON
  fi

  : "${ADMIN_USER:?admin username missing}"
  : "${ADMIN_PASS:?admin password missing}"
  ADMIN_CMD=(mysql \
    --host="$DB_HOST" \
    --port="$DB_PORT" \
    --protocol=tcp \
    --user="$ADMIN_USER" \
    --connect-timeout=15 \
    --default-character-set=utf8mb4)
  echo "Using remote admin user $ADMIN_USER at $DB_HOST:$DB_PORT"
fi

run_admin() {
  if [[ -n "${ADMIN_PASS:-}" ]]; then
    MYSQL_PWD="$ADMIN_PASS" "${ADMIN_CMD[@]}" "$@"
  else
    "${ADMIN_CMD[@]}" "$@"
  fi
}

echo "Dropping and recreating database $DB_NAME"
run_admin -e "DROP DATABASE IF EXISTS \`$DB_NAME\`; CREATE DATABASE \`$DB_NAME\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
gunzip -c "$DUMP" | run_admin "$DB_NAME"

if (( ! LOCAL_SOCKET )); then
  DB_PASS_SQL="${DB_PASS//\\/\\\\}"
  DB_PASS_SQL="${DB_PASS_SQL//\'/\'\'}"
  run_admin -e "
    CREATE USER IF NOT EXISTS '$DB_USER'@'%' IDENTIFIED BY '$DB_PASS_SQL';
    GRANT SELECT, INSERT, UPDATE, DELETE, CREATE TEMPORARY TABLES,
          LOCK TABLES, EXECUTE, SHOW VIEW, TRIGGER
      ON \`$DB_NAME\`.* TO '$DB_USER'@'%';
    FLUSH PRIVILEGES;
  "
  unset DB_PASS_SQL
fi

TABLE_COUNT="$(run_admin --batch --skip-column-names -e \
  "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='$DB_NAME';")"
echo "Restore complete from s3://$BUCKET/$KEY ($TABLE_COUNT tables)"

if [[ -n "$DB_PASS" ]]; then
  if env MYSQL_PWD="$DB_PASS" mysql \
    --host="$DB_HOST" --port="$DB_PORT" --user="$DB_USER" "$DB_NAME" \
    --connect-timeout=10 -e 'SELECT 1' >/dev/null 2>&1; then
    echo "Application database connection OK"
  else
    echo "WARNING: application database connection failed after restore" >&2
  fi
fi
