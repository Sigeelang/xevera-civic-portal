#!/usr/bin/env bash
# Create the Xevera backend .env without echoing secrets.
#
# Run as root on a fresh instance:
#   sudo bash /var/www/xevera/deploy/configure-env.sh
#
# If restoring an existing .env, do NOT run this script; copy the old .env
# instead. Use --force only when you intentionally want to replace it.
set -Eeuo pipefail
IFS=$'\n\t'

APP_DIR="${XEVERA_APP_DIR:-/var/www/xevera}"
RUN_USER="${XEVERA_RUN_USER:-apache}"
DOMAIN="${XEVERA_DOMAIN:-xevera-portal.duckdns.org}"
ENV_FILE="$APP_DIR/backend/.env"
SECRET_FILE="$APP_DIR/.xevera_secret"

FORCE=0
while (($#)); do
    case "$1" in
        --force) FORCE=1 ;;
        -h|--help)
            cat <<'EOF'
Usage: sudo bash deploy/configure-env.sh [--force]

Prompts for the database password and Gmail App Password without echoing them,
writes backend/.env with mode 0640, and generates /.xevera_secret when missing.

Set XEVERA_DB_HOST to change the default database host, for example:
  sudo XEVERA_DB_HOST=xevera-civic-db.example.rds.amazonaws.com \
    bash deploy/configure-env.sh
EOF
            exit 0
            ;;
        *) printf 'Unknown option: %s\n' "$1" >&2; exit 1 ;;
    esac
    shift
done

log()  { printf '\n==> %s\n' "$*"; }
warn() { printf 'WARNING: %s\n' "$*" >&2; }
die()  { printf 'ERROR: %s\n' "$*" >&2; exit 1; }

trap 'rc=$?; printf "ERROR: configure-env failed at line %s (exit %s)\n" "$LINENO" "$rc" >&2' ERR

[[ ${EUID:-$(id -u)} -eq 0 ]] || die "run this script with sudo"
[[ -t 0 ]] || die "this script needs an interactive terminal"
[[ -d "$APP_DIR/backend" ]] || die "missing $APP_DIR/backend; clone the repository first"

if [[ -f "$ENV_FILE" && "$FORCE" -ne 1 ]]; then
    die "$ENV_FILE already exists; copy the old file or use --force"
fi

if [[ "$FORCE" -eq 1 && -f "$ENV_FILE" ]]; then
    BACKUP="/root/xevera-env-backup-$(date -u +%Y%m%dT%H%M%SZ)"
    install -m 0600 "$ENV_FILE" "$BACKUP"
    warn "existing .env backed up to $BACKUP"
fi

read -r -p "Application URL [https://$DOMAIN]: " APP_URL
APP_URL="${APP_URL:-https://$DOMAIN}"

DB_HOST_DEFAULT="${XEVERA_DB_HOST:-127.0.0.1}"
read -r -p "Database host [$DB_HOST_DEFAULT]: " DB_HOST
DB_HOST="${DB_HOST:-$DB_HOST_DEFAULT}"

read -r -p "Database port [3306]: " DB_PORT
DB_PORT="${DB_PORT:-3306}"

read -r -p "Database name [xevera_civic]: " DB_NAME
DB_NAME="${DB_NAME:-xevera_civic}"

read -r -p "Database user [xevera_app]: " DB_USER
DB_USER="${DB_USER:-xevera_app}"

read -r -s -p "Database password: " DB_PASS
printf '\n'
[[ -n "$DB_PASS" ]] || die "database password cannot be empty"

read -r -p "Enable Gmail SMTP OTP delivery? [Y/n]: " ENABLE_MAIL
ENABLE_MAIL="${ENABLE_MAIL:-Y}"

SMTP_USER="xeveraportal@gmail.com"
SMTP_PASS=""
if [[ "$ENABLE_MAIL" =~ ^[Yy] ]]; then
    read -r -p "Gmail sender/user [$SMTP_USER]: " INPUT_SMTP_USER
    SMTP_USER="${INPUT_SMTP_USER:-$SMTP_USER}"

    read -r -s -p "Gmail App Password (16 characters, not the account password): " SMTP_PASS
    printf '\n'
    [[ -n "$SMTP_PASS" ]] || die "Gmail App Password is required when mail is enabled"
    MAIL_ENABLED=1
else
    MAIL_ENABLED=0
    warn "mail disabled; OTP, verification, and password-reset emails will not be sent"
fi

if [[ ! -s "$SECRET_FILE" ]]; then
    log "Generating /.xevera_secret"
    warn "if this replaces an unrecovered old secret, all existing login tokens become invalid"
    umask 077
    openssl rand -hex 32 > "$SECRET_FILE"
    umask 022
else
    log "Keeping existing /.xevera_secret"
fi

log "Writing $ENV_FILE"
TMP_ENV="$(mktemp /tmp/xevera-env.XXXXXX)"
trap 'rm -f "$TMP_ENV"' EXIT

{
    printf 'APP_NAME=Xevera Portal\n'
    printf 'APP_URL=%s\n' "$APP_URL"
    printf 'CORS_ALLOW_ORIGINS=%s,http://%s\n' "$APP_URL" "$DOMAIN"
    printf 'AWS_REGION=%s\n' "${AWS_REGION:-ap-southeast-1}"
    printf 'XEVERA_USE_SECRETS_MANAGER=0\n'
    printf '\n'
    printf 'DB_HOST=%s\n' "$DB_HOST"
    printf 'DB_PORT=%s\n' "$DB_PORT"
    printf 'DB_NAME=%s\n' "$DB_NAME"
    printf 'DB_USER=%s\n' "$DB_USER"
    printf 'DB_PASS=%s\n' "$DB_PASS"
    printf '\n'
    printf 'MAIL_ENABLED=%s\n' "$MAIL_ENABLED"
    printf 'MAIL_PROVIDER=smtp\n'
    printf 'MAIL_FROM=%s\n' "$SMTP_USER"
    printf 'XEVERA_SMTP_HOST=ssl://smtp.gmail.com\n'
    printf 'XEVERA_SMTP_PORT=465\n'
    printf 'XEVERA_SMTP_USER=%s\n' "$SMTP_USER"
    printf 'XEVERA_SMTP_PASS=%s\n' "$SMTP_PASS"
    printf 'XEVERA_SMTP_FROM=%s\n' "$SMTP_USER"
    printf 'XEVERA_SMTP_USE_SECRETS_MANAGER=0\n'
} > "$TMP_ENV"

install -m 0640 -o "$RUN_USER" -g "$RUN_USER" "$TMP_ENV" "$ENV_FILE"
chown "$RUN_USER:$RUN_USER" "$SECRET_FILE"
chmod 0640 "$SECRET_FILE"

unset DB_PASS SMTP_PASS
rm -f "$TMP_ENV"
trap - EXIT

log "Environment written"
cat <<EOF
File:    $ENV_FILE
Owner:   $RUN_USER:$RUN_USER
Mode:    0640
Mail:    $([[ "$MAIL_ENABLED" == "1" ]] && echo enabled || echo disabled)

Next:
  sudo bash $APP_DIR/deploy/deploy.sh
EOF

if [[ "$DB_HOST" != "127.0.0.1" && "$DB_HOST" != "localhost" ]]; then
    cat <<EOF

Remote database (RDS) restore, only for a fresh/empty database:
  sudo XEVERA_DB_ADMIN_SECRET_ARN='<rds-master-secret-arn>' \\
    /usr/local/sbin/xevera-db-restore --yes
EOF
else
    cat <<EOF
  sudo /usr/local/sbin/xevera-db-restore --yes   # only for a fresh/empty database
EOF
fi
