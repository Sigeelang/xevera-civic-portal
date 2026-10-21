#!/usr/bin/env bash
# Xevera Civic Portal - safe, repeatable EC2 deployment
#
# Run as root:
#   sudo bash /var/www/xevera/deploy/deploy.sh
#
# This script never deletes the application directory, uploads, .env, or the
# database. It refuses to update a dirty Git checkout and never prints secrets.
#
# Options:
#   --skip-build     Reuse the existing frontend build and vendor directory.
#   --request-cert   Request a Let's Encrypt certificate if none exists.
#   --skip-db        Do not create/update or check the database.
#   -h, --help       Show this help.
#
# A remote DB_HOST (RDS) automatically skips local MariaDB user/database setup.
set -Eeuo pipefail
IFS=$'\n\t'

APP_DIR="${XEVERA_APP_DIR:-/var/www/xevera}"
REPO_URL="${XEVERA_REPO_URL:-https://github.com/Sigeelang/xevera-civic-portal.git}"
BRANCH="${XEVERA_BRANCH:-main}"
DOMAIN="${XEVERA_DOMAIN:-xevera-portal.duckdns.org}"
RUN_USER="${XEVERA_RUN_USER:-apache}"
APACHE_CONF_DIR="${XEVERA_APACHE_CONF_DIR:-/etc/httpd/conf.d}"
PHP_INI_DIR="${XEVERA_PHP_INI_DIR:-/etc/php.d}"
CERT_DIR="${XEVERA_CERT_DIR:-/etc/letsencrypt/live/$DOMAIN}"
CERTBOT_EMAIL="${XEVERA_CERTBOT_EMAIL:-xeveraportal@gmail.com}"

BUILD=1
REQUEST_CERT=0
SETUP_DB=1

log()  { printf '\n==> %s\n' "$*"; }
warn() { printf 'WARNING: %s\n' "$*" >&2; }
die()  { printf 'ERROR: %s\n' "$*" >&2; exit 1; }

usage() {
    cat <<'EOF'
Xevera deployment

Usage:
  sudo bash deploy/deploy.sh [options]

Options:
  --skip-build     Reuse existing frontend build and PHP vendor directory.
  --request-cert   Request a new Let's Encrypt certificate if one is missing.
  --skip-db        Do not create/update or check the database.
  -h, --help       Show this help.

Remote DB_HOST values (for example RDS) skip local MariaDB setup automatically.

Environment overrides:
  XEVERA_APP_DIR, XEVERA_REPO_URL, XEVERA_BRANCH, XEVERA_DOMAIN,
  XEVERA_RUN_USER, XEVERA_APACHE_CONF_DIR, XEVERA_PHP_INI_DIR,
  XEVERA_CERT_DIR, XEVERA_CERTBOT_EMAIL
EOF
}

while (($#)); do
    case "$1" in
        --skip-build)   BUILD=0 ;;
        --request-cert) REQUEST_CERT=1 ;;
        --skip-db)      SETUP_DB=0 ;;
        -h|--help)      usage; exit 0 ;;
        *)              die "unknown option: $1 (use --help)" ;;
    esac
    shift
done

trap 'rc=$?; printf "ERROR: deploy failed at line %s (exit %s)\n" "$LINENO" "$rc" >&2' ERR

[[ ${EUID:-$(id -u)} -eq 0 ]] || die "run this script with sudo"

for cmd in git runuser httpd php mariadb curl openssl systemctl; do
    command -v "$cmd" >/dev/null 2>&1 || die "missing '$cmd'; run: sudo bash $APP_DIR/deploy/bootstrap-ec2.sh"
done
if (( BUILD )); then
    command -v npm >/dev/null 2>&1 || die "missing npm; run bootstrap-ec2.sh"
    command -v composer >/dev/null 2>&1 || die "missing composer; run bootstrap-ec2.sh"
fi
run_as_app() {
    runuser -u "$RUN_USER" -- env HOME=/tmp "$@"
}

read_env() {
    local key="$1" line value
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

log "Preparing $APP_DIR"

if [[ ! -d "$APP_DIR/.git" ]]; then
    if [[ -d "$APP_DIR" ]] && [[ -n "$(find "$APP_DIR" -mindepth 1 -maxdepth 1 -print -quit 2>/dev/null)" ]]; then
        die "$APP_DIR exists but is not a Git checkout; move it aside first"
    fi
    install -d -m 0755 -o "$RUN_USER" -g "$RUN_USER" "$APP_DIR"
    log "Cloning $REPO_URL ($BRANCH)"
    run_as_app git clone --branch "$BRANCH" "$REPO_URL" "$APP_DIR"
else
    log "Checking Git worktree"
    DIRTY="$(run_as_app git -C "$APP_DIR" status --porcelain)"
    if [[ -n "$DIRTY" ]]; then
        printf '%s\n' "$DIRTY" >&2
        die "the checkout is dirty; commit, stash, or reconcile it before deploying"
    fi

    run_as_app git -C "$APP_DIR" fetch --prune origin "$BRANCH"
    CURRENT_BRANCH="$(run_as_app git -C "$APP_DIR" rev-parse --abbrev-ref HEAD)"
    if [[ "$CURRENT_BRANCH" != "$BRANCH" ]]; then
        run_as_app git -C "$APP_DIR" checkout "$BRANCH"
    fi
    run_as_app git -C "$APP_DIR" merge --ff-only "origin/$BRANCH"
fi

[[ -d "$APP_DIR/backend" ]] || die "backend directory missing after checkout"
[[ -d "$APP_DIR/frontend" ]] || die "frontend directory missing after checkout"

COMMIT="$(run_as_app git -C "$APP_DIR" rev-parse --short HEAD)"
COMMIT_SUBJECT="$(run_as_app git -C "$APP_DIR" log -1 --pretty='%s')"
ENV_FILE="$APP_DIR/backend/.env"
SECRET_FILE="$APP_DIR/.xevera_secret"

log "Validating environment"
if [[ ! -r "$ENV_FILE" ]]; then
    die "missing $ENV_FILE; run: sudo bash $APP_DIR/deploy/configure-env.sh"
fi
for key in APP_URL DB_HOST DB_PORT DB_NAME DB_USER DB_PASS; do
    grep -Eq "^[[:space:]]*(export[[:space:]]+)?${key}=" "$ENV_FILE" \
        || die "missing ${key} in $ENV_FILE"
done
[[ -n "$(read_env DB_PASS)" ]] || die "DB_PASS is empty in $ENV_FILE"
[[ -n "$(read_env APP_URL)" ]] || die "APP_URL is empty in $ENV_FILE"

DB_HOST="$(read_env DB_HOST)"
DB_PORT="$(read_env DB_PORT)"
DB_NAME="$(read_env DB_NAME)"
DB_USER="$(read_env DB_USER)"
DB_PASS="$(read_env DB_PASS)"
DB_HOST="${DB_HOST:-127.0.0.1}"
DB_PORT="${DB_PORT:-3306}"
DB_IS_LOCAL=1
case "$DB_HOST" in
    ""|127.0.0.1|localhost|::1) ;;
    *) DB_IS_LOCAL=0 ;;
esac

if [[ -z "$(read_env APP_KEY)" && ! -s "$SECRET_FILE" ]]; then
    warn "APP_KEY is not set and .xevera_secret is missing; generating a new signing secret"
    warn "Existing sessions would be invalidated if this replaces an old secret"
    umask 077
    openssl rand -hex 32 > "$SECRET_FILE"
    umask 022
fi

install -d -m 0755 -o "$RUN_USER" -g "$RUN_USER" \
    "$APP_DIR/backend/uploads" \
    "$APP_DIR/backend/storage/mail_queue" \
    "$APP_DIR/frontend/dist"

if (( BUILD )); then
    log "Installing frontend dependencies"
    run_as_app bash -c "export PATH=/usr/local/bin:/usr/bin:/bin; cd '$APP_DIR/frontend' && npm ci --no-audit --no-fund"

    log "Building frontend"
    run_as_app bash -c "export PATH=/usr/local/bin:/usr/bin:/bin; cd '$APP_DIR/frontend' && npm run build"

    log "Installing backend dependencies"
    run_as_app composer install \
        --working-dir="$APP_DIR/backend" \
        --no-dev \
        --optimize-autoloader \
        --no-interaction
else
    warn "skipping frontend build and Composer install (--skip-build)"
    [[ -d "$APP_DIR/frontend/dist" ]] || die "frontend/dist is missing; rerun without --skip-build"
    [[ -d "$APP_DIR/backend/vendor" ]] || die "backend/vendor is missing; rerun without --skip-build"
fi

log "Setting ownership and permissions"
chown -R "$RUN_USER:$RUN_USER" "$APP_DIR"
find "$APP_DIR/frontend/dist" -type d -exec chmod 0755 {} +
find "$APP_DIR/frontend/dist" -type f -exec chmod 0644 {} +
chmod 0755 "$APP_DIR" "$APP_DIR/frontend/dist"
chmod 0640 "$ENV_FILE"
[[ -f "$SECRET_FILE" ]] && chmod 0640 "$SECRET_FILE"
chmod 0755 "$APP_DIR/backend/uploads" "$APP_DIR/backend/storage" "$APP_DIR/backend/storage/mail_queue"

if command -v restorecon >/dev/null 2>&1; then
    restorecon -Rv "$APP_DIR" >/dev/null 2>&1 || true
fi

log "Installing PHP settings"
PHP_INI_SRC="$APP_DIR/deploy/php/99-xevera.ini"
if [[ -f "$PHP_INI_SRC" ]]; then
    install -d -m 0755 "$PHP_INI_DIR"
    install -m 0644 "$PHP_INI_SRC" "$PHP_INI_DIR/99-xevera.ini"
    if systemctl is-active --quiet php-fpm; then
        systemctl reload php-fpm
    else
        systemctl restart php-fpm
    fi
else
    warn "missing $PHP_INI_SRC; keeping existing PHP limits"
fi

log "Installing Apache configuration"
install -d -m 0755 "$APACHE_CONF_DIR"
install -m 0644 "$APP_DIR/deploy/apache/xevera.conf" "$APACHE_CONF_DIR/xevera.conf"
install -m 0644 "$APP_DIR/deploy/apache/xevera-cache.conf" "$APACHE_CONF_DIR/xevera-cache.conf"

SSL_SRC="$APP_DIR/deploy/apache/xevera-ssl.conf"
SSL_DST="$APACHE_CONF_DIR/xevera-ssl.conf"
CERT_FULLCHAIN="$CERT_DIR/fullchain.pem"
CERT_KEY="$CERT_DIR/privkey.pem"

install_ssl_vhost() {
    install -m 0644 "$SSL_SRC" "$SSL_DST"
}

reload_httpd() {
    apachectl configtest
    if systemctl is-active --quiet httpd; then
        systemctl reload httpd
    else
        systemctl start httpd
    fi
}

if [[ -f "$CERT_FULLCHAIN" && -f "$CERT_KEY" ]]; then
    install_ssl_vhost
else
    if [[ -f "$SSL_DST" ]]; then
        BACKUP="$SSL_DST.disabled-$(date -u +%Y%m%dT%H%M%SZ)"
        mv "$SSL_DST" "$BACKUP"
        warn "moved stale SSL vhost aside: $BACKUP"
    fi
    warn "TLS certificate not found at $CERT_DIR; HTTP vhost only for now"
fi

reload_httpd

if (( REQUEST_CERT )) && [[ ! -f "$CERT_FULLCHAIN" ]]; then
    log "Requesting Let's Encrypt certificate for $DOMAIN"
    if certbot certonly \
        --webroot -w "$APP_DIR/frontend/dist" \
        -d "$DOMAIN" \
        --agree-tos \
        --email "$CERTBOT_EMAIL" \
        --non-interactive
    then
        install_ssl_vhost
        reload_httpd
    else
        warn "certificate request failed; confirm DNS/EIP/port 80 and rerun with --request-cert"
    fi
fi

if [[ -d /etc/letsencrypt ]]; then
    log "Installing certbot reload hook"
    install -d -m 0755 /etc/letsencrypt/renewal-hooks/deploy
    install -m 0755 "$APP_DIR/deploy/letsencrypt/reload-httpd.sh" \
        /etc/letsencrypt/renewal-hooks/deploy/reload-httpd.sh
fi
systemctl enable --now certbot-renew.timer 2>/dev/null \
    || warn "could not enable certbot-renew.timer"

if (( SETUP_DB )); then
    if (( DB_IS_LOCAL )); then
        log "Checking local MariaDB access"
        systemctl is-active --quiet mariadb || die "mariadb is not running; run bootstrap-ec2.sh"

        DB_PASS_SQL="${DB_PASS//\\/\\\\}"
        DB_PASS_SQL="${DB_PASS_SQL//\'/\'\'}"
        mariadb -e "CREATE DATABASE IF NOT EXISTS \`$DB_NAME\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
        mariadb -e "
            CREATE USER IF NOT EXISTS '$DB_USER'@'127.0.0.1' IDENTIFIED BY '$DB_PASS_SQL';
            CREATE USER IF NOT EXISTS '$DB_USER'@'localhost' IDENTIFIED BY '$DB_PASS_SQL';
            ALTER USER '$DB_USER'@'127.0.0.1' IDENTIFIED BY '$DB_PASS_SQL';
            ALTER USER '$DB_USER'@'localhost' IDENTIFIED BY '$DB_PASS_SQL';
            GRANT ALL PRIVILEGES ON \`$DB_NAME\`.* TO '$DB_USER'@'127.0.0.1';
            GRANT ALL PRIVILEGES ON \`$DB_NAME\`.* TO '$DB_USER'@'localhost';
            FLUSH PRIVILEGES;
        "
        unset DB_PASS_SQL
    else
        log "Checking remote database access (RDS): $DB_HOST:$DB_PORT"
    fi

    if env MYSQL_PWD="$DB_PASS" mariadb \
        --host="$DB_HOST" --port="$DB_PORT" --user="$DB_USER" "$DB_NAME" \
        --connect-timeout=10 -e 'SELECT 1' >/dev/null 2>&1
    then
        log "Application database connection OK"
        TABLE_COUNT="$(env MYSQL_PWD="$DB_PASS" mariadb \
            --host="$DB_HOST" --port="$DB_PORT" --user="$DB_USER" "$DB_NAME" \
            --connect-timeout=10 --batch --skip-column-names \
            -e "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='$DB_NAME';")"
        if [[ "$TABLE_COUNT" == "0" ]]; then
            warn "database '$DB_NAME' is empty"
            if (( DB_IS_LOCAL )); then
                warn "restore with: sudo /usr/local/sbin/xevera-db-restore --yes"
            else
                warn "restore with: sudo XEVERA_DB_ADMIN_SECRET_ARN='<rds-master-secret-arn>' /usr/local/sbin/xevera-db-restore --yes"
            fi
        else
            log "Database '$DB_NAME' has $TABLE_COUNT tables"
        fi
    else
        warn "application database connection failed; check DB_* values, security groups, and grants"
    fi
    unset DB_PASS
fi
unset DB_PASS

log "Installing database backup timer"
bash "$APP_DIR/deploy/install-db-backup.sh"

log "Running smoke tests"
HTTP_CODE="$(curl -sS -o /dev/null -w '%{http_code}' \
    -H "Host: $DOMAIN" http://127.0.0.1/ 2>/dev/null || true)"
if [[ "$HTTP_CODE" =~ ^(200|301|302|307|308)$ ]]; then
    log "HTTP smoke test: $HTTP_CODE"
else
    warn "HTTP smoke test returned '${HTTP_CODE:-no response}'"
fi

if [[ -f "$CERT_FULLCHAIN" ]]; then
    HTTPS_CODE="$(curl -sS -o /dev/null -w '%{http_code}' \
        --resolve "$DOMAIN:443:127.0.0.1" \
        "https://$DOMAIN/" 2>/dev/null || true)"
    if [[ "$HTTPS_CODE" == "200" ]]; then
        log "HTTPS smoke test: 200"
    else
        warn "HTTPS smoke test returned '${HTTPS_CODE:-no response}'"
    fi
else
    warn "HTTPS not tested because the certificate is missing"
fi

log "Deployment complete"
cat <<EOF
Commit:        $COMMIT $COMMIT_SUBJECT
App directory: $APP_DIR
Domain:        $DOMAIN
Database:      $DB_NAME at $DB_HOST:$DB_PORT ($([[ "$DB_IS_LOCAL" == "1" ]] && echo local || echo remote/RDS))
PHP limits:    $([[ -f "$PHP_INI_DIR/99-xevera.ini" ]] && echo installed || echo missing)
TLS:           $([[ -f "$CERT_FULLCHAIN" ]] && echo present || echo missing)
Backup timer:  $([[ -f /etc/systemd/system/xevera-db-backup.timer ]] && echo installed || echo missing)

Next steps:
EOF

if (( DB_IS_LOCAL )); then
    cat <<EOF
  1. Restore the database on a fresh instance:
       sudo /usr/local/sbin/xevera-db-restore --yes
EOF
else
    cat <<EOF
  1. Restore the database on a fresh RDS instance:
       sudo XEVERA_DB_ADMIN_SECRET_ARN='<rds-master-secret-arn>' \\
         /usr/local/sbin/xevera-db-restore --yes
EOF
fi

cat <<EOF
  2. Restore backend/uploads, .env, and .xevera_secret from your backup.
  3. Confirm the Elastic IP/DNS points to this instance.
  4. Test login, OTP, uploads, and a manual backup.
EOF
