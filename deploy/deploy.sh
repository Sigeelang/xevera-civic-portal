#!/usr/bin/env bash
# Xevera production deployment script
# Run as: bash deploy/deploy.sh
#
# Prereqs:
#   - EC2 instance running Amazon Linux 2023
#   - Apache + PHP 8.x + php-fpm installed
#   - /var/www/xevera/ already exists
#   - .env in backend/ with all required vars
#   - RDS database accessible
#
# This script:
#   1. Pulls the latest from the GitHub repo (or syncs from local)
#   2. Builds the frontend (npm ci && npm run build)
#   3. Copies deploy/apache/xevera.conf to /etc/httpd/conf.d/
#   4. Reloads Apache
#   5. Runs a quick smoke test

set -euo pipefail

APP_DIR="/var/www/xevera"
REPO_URL="https://github.com/Sigeelang/xevera-civic-portal.git"

echo "==> Deploying Xevera Civic Portal"

# 1. Sync code (if not already there)
if [ ! -d "$APP_DIR/.git" ]; then
    echo "==> Cloning repo to $APP_DIR"
    sudo rm -rf "$APP_DIR"
    sudo git clone "$REPO_URL" "$APP_DIR"
    cd "$APP_DIR"
else
    echo "==> Pulling latest"
    cd "$APP_DIR"
    sudo git pull --ff-only
fi

# 2. Install + build frontend
echo "==> Installing frontend deps"
cd "$APP_DIR/frontend"
sudo npm ci --no-audit --no-fund

echo "==> Building frontend"
sudo npm run build

# 3. Install backend deps
echo "==> Installing backend deps"
cd "$APP_DIR/backend"
sudo composer install --no-dev --optimize-autoloader --no-interaction

# 4. Apply Apache vhost
echo "==> Installing Apache vhost"
sudo cp "$APP_DIR/deploy/apache/xevera.conf" /etc/httpd/conf.d/xevera.conf
sudo apachectl configtest
sudo systemctl reload httpd

# 5. Smoke test
echo "==> Smoke test"
sleep 2
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost/)
echo "    GET / -> HTTP $HTTP_CODE"

JS_SIZE=$(curl -s -o /dev/null -w "%{size_download}" http://localhost/assets/index-*.js 2>/dev/null | head -1 || echo "0")
echo "    GET /assets/*.js -> size $JS_SIZE bytes"

echo "==> Deploy complete"
