#!/usr/bin/env bash
set -Eeuo pipefail

# Certbot deploy hook: only reload Apache after the configuration is valid.
apachectl configtest
systemctl reload httpd
