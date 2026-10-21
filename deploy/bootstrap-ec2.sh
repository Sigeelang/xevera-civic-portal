#!/usr/bin/env bash
# Bootstrap Amazon Linux 2023 for the Xevera Civic Portal.
#
# Run as root from an existing checkout:
#   sudo bash /var/www/xevera/deploy/bootstrap-ec2.sh
#
# If /var/www/xevera is empty, this script clones the public repository there.
# It does not restore the database, uploads, or .env secrets.
set -Eeuo pipefail
IFS=$'\n\t'

APP_DIR="${XEVERA_APP_DIR:-/var/www/xevera}"
REPO_URL="${XEVERA_REPO_URL:-https://github.com/Sigeelang/xevera-civic-portal.git}"
BRANCH="${XEVERA_BRANCH:-main}"
RUN_USER="${XEVERA_RUN_USER:-apache}"

DO_UPDATE=1
DATABASE_MODE="local"
while (($#)); do
    case "$1" in
        --no-update) DO_UPDATE=0 ;;
        --rds)       DATABASE_MODE="rds" ;;
        -h|--help)
            cat <<'EOF'
Usage: sudo bash deploy/bootstrap-ec2.sh [--no-update] [--rds]

Installs Amazon Linux 2023 packages, enables Apache/PHP-FPM/firewalld,
enables the certbot timer, and clones the app if the application directory is
empty.

  --rds   Do not install or start a local MariaDB server. MariaDB client tools
          are still installed for RDS connections and dumps.

Without --rds, a local MariaDB server is installed and bound to 127.0.0.1.
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

trap 'rc=$?; printf "ERROR: bootstrap failed at line %s (exit %s)\n" "$LINENO" "$rc" >&2' ERR

[[ ${EUID:-$(id -u)} -eq 0 ]] || die "run this script with sudo"
command -v dnf >/dev/null 2>&1 || die "this script requires Amazon Linux 2023 / dnf"

if ! grep -q 'VERSION_ID="2023"' /etc/os-release 2>/dev/null; then
    warn "this does not look like Amazon Linux 2023; continuing anyway"
fi

if (( DO_UPDATE )); then
    log "Updating installed packages"
    dnf update -y
fi

log "Installing Apache, PHP 8.5, MariaDB client tools, Composer, Certbot, and AWS CLI"
DB_PACKAGES=(mariadb105 mariadb105-backup)
if [[ "$DATABASE_MODE" == "local" ]]; then
    DB_PACKAGES+=(mariadb105-server)
fi
dnf install -y \
    git tar gzip openssl \
    httpd mod_ssl \
    php8.5-cli php8.5-common php8.5-fpm \
    php8.5-mysqlnd php8.5-mbstring php8.5-gd \
    php8.5-intl php8.5-xml php8.5-zip \
    php8.5-pdo php8.5-process \
    "${DB_PACKAGES[@]}" \
    awscli-2 certbot python3-certbot-apache \
    composer firewalld chrony

# Do not install Amazon's nodejs20 packages over an existing NodeSource install;
# the file paths conflict. A fresh AL2023 instance has no node/npm, so it gets
# the Amazon packages here.
if command -v node >/dev/null 2>&1 && command -v npm >/dev/null 2>&1; then
    NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0)"
    if (( NODE_MAJOR < 20 )); then
        die "Node.js $(node --version) is too old; remove it and rerun this script"
    fi
    log "Node.js $(node --version) and npm $(npm --version) already present; skipping nodejs20 packages"
else
    log "Installing Node.js 20 and npm"
    dnf install -y nodejs20 nodejs20-npm
fi

log "Setting UTC timezone and enabling time sync"
timedatectl set-timezone UTC
systemctl enable --now chronyd

log "Configuring firewall"
systemctl enable --now firewalld
firewall-cmd --permanent --add-service=http
firewall-cmd --permanent --add-service=https
firewall-cmd --reload

if [[ "$DATABASE_MODE" == "local" ]]; then
    log "Pinning MariaDB to localhost"
    cat > /etc/my.cnf.d/xevera.cnf <<'EOF'
[mysqld]
bind-address=127.0.0.1
EOF
    systemctl enable mariadb
    systemctl restart mariadb
else
    log "RDS mode: skipping local MariaDB server"
fi

log "Enabling PHP-FPM and Apache"
systemctl enable --now php-fpm
systemctl enable --now httpd
apachectl configtest

log "Enabling Let's Encrypt renewal timer"
systemctl enable --now certbot-renew.timer

if ! swapon --show 2>/dev/null | grep -q .; then
    MEM_KB="$(awk '/MemTotal/ {print $2}' /proc/meminfo)"
    if [[ -n "$MEM_KB" ]] && (( MEM_KB < 1800000 )); then
        log "Creating 1 GB swap file for the small instance"
        fallocate -l 1G /swapfile 2>/dev/null || dd if=/dev/zero of=/swapfile bs=1M count=1024 status=none
        chmod 600 /swapfile
        mkswap /swapfile >/dev/null
        swapon /swapfile
        grep -q '^/swapfile ' /etc/fstab || printf '/swapfile none swap sw 0 0\n' >> /etc/fstab
    fi
fi

if [[ ! -d "$APP_DIR/.git" ]]; then
    if [[ -d "$APP_DIR" ]] && [[ -n "$(find "$APP_DIR" -mindepth 1 -maxdepth 1 -print -quit 2>/dev/null)" ]]; then
        die "$APP_DIR exists and is not a Git checkout; move it aside first"
    fi
    log "Cloning application into $APP_DIR"
    install -d -m 0755 -o "$RUN_USER" -g "$RUN_USER" "$APP_DIR"
    runuser -u "$RUN_USER" -- env HOME=/tmp git clone --branch "$BRANCH" "$REPO_URL" "$APP_DIR"
fi

chown -R "$RUN_USER:$RUN_USER" "$APP_DIR"
if command -v restorecon >/dev/null 2>&1; then
    restorecon -Rv "$APP_DIR" >/dev/null 2>&1 || true
fi

APACHE_VERSION="$(httpd -v 2>/dev/null | sed -n 's|.*Apache/\([0-9.]*\).*|\1|p')"
PHP_VERSION="$(php -r 'echo PHP_VERSION;' 2>/dev/null || true)"
NODE_VERSION="$(node --version 2>/dev/null || true)"
COMPOSER_VERSION="$(composer --version 2>/dev/null | awk '{print $3}' || true)"

log "Bootstrap complete"
cat <<EOF
Installed:
  Apache   ${APACHE_VERSION:-unknown}
  PHP      ${PHP_VERSION:-unknown}
  Node     ${NODE_VERSION:-unknown}
  Composer ${COMPOSER_VERSION:-unknown}

Database mode: $DATABASE_MODE

Next steps:
  1. Create the environment file:
       sudo bash $APP_DIR/deploy/configure-env.sh
  2. Deploy the application:
       sudo bash $APP_DIR/deploy/deploy.sh
  3. On a fresh database, restore the latest backup:
       sudo /usr/local/sbin/xevera-db-restore --yes
  4. Restore backend/uploads, .env, and .xevera_secret from your backup.
EOF
