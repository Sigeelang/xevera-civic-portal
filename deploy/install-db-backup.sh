#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

install -m 0750 "$SCRIPT_DIR/db-backup.sh" /usr/local/sbin/xevera-db-backup
install -m 0750 "$SCRIPT_DIR/db-restore.sh" /usr/local/sbin/xevera-db-restore
install -m 0644 "$SCRIPT_DIR/systemd/xevera-db-backup.service" /etc/systemd/system/xevera-db-backup.service
install -m 0644 "$SCRIPT_DIR/systemd/xevera-db-backup.timer" /etc/systemd/system/xevera-db-backup.timer

systemctl daemon-reload
systemctl enable --now xevera-db-backup.timer
systemctl list-timers xevera-db-backup.timer --no-pager
