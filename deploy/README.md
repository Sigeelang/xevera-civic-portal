# Deploy

Production deployment artifacts for the Xevera Civic Portal.

## Files

- `apache/xevera.conf` — Apache HTTP vhost. Drop into `/etc/httpd/conf.d/`.
  - Uses first-match-wins rewrite pattern.
  - In vhost context, `%{REQUEST_FILENAME}` is the URL path; use `%{DOCUMENT_ROOT}%{REQUEST_URI}` for file/dir checks.
  - Sets `AllowOverride None` on the frontend dist directory to prevent `.htaccess` interference.
  - Exempts `/.well-known/acme-challenge/` from the HTTP→HTTPS redirect.
- `apache/xevera-ssl.conf` — Apache HTTPS vhost for `xevera-portal.duckdns.org` using the Let's Encrypt cert.
- `deploy.sh` — One-shot deploy script (clones repo, builds, reloads Apache).

## Manual deploy steps

```bash
# 1. Copy vhosts
sudo cp deploy/apache/xevera.conf /etc/httpd/conf.d/xevera.conf
sudo cp deploy/apache/xevera-ssl.conf /etc/httpd/conf.d/xevera-ssl.conf
sudo apachectl configtest
sudo systemctl reload httpd

# 2. Issue / renew the TLS certificate (first time only)
sudo certbot certonly --webroot -w /var/www/xevera/frontend/dist \
  -d xevera-portal.duckdns.org --agree-tos -m xeveraportal@gmail.com
sudo systemctl reload httpd

# 3. Verify
curl -I https://xevera-portal.duckdns.org/          # 200, text/html
curl -I https://xevera-portal.duckdns.org/admin     # 200, SPA index.html
curl -X POST https://xevera-portal.duckdns.org/api/auth/login.php \
  -H "Content-Type: application/json" \
  -d '{"email":"***REMOVED***","password":"***REMOVED***"}'
```

## HTTPS notes

- DNS: DuckDNS `xevera-portal` → instance public IP (`18.139.139.159`).
- Certificate: Let's Encrypt (webroot), auto-renewed by the certbot timer/cron; Apache reload after renewal.
- `certbot renew --dry-run` should report success.

## Key learnings (do not regress)

1. **`RewriteCond` scope** — only attaches to the IMMEDIATELY following `RewriteRule`. Use a first-match-wins chain with `[L]` flags.
2. **`%{REQUEST_FILENAME}` in vhost context** — this is the URL path, not the filesystem path. Use `%{DOCUMENT_ROOT}%{REQUEST_URI}` for `-f`/`-d` checks.
3. **`AllowOverride None`** — on the frontend dist directory, prevents any stale `.htaccess` from a build artifact from breaking the vhost rules.
4. **ServerAlias the instance IP** — so the bare IP works before DNS is set up.
5. **ACME exemption** — `/.well-known/acme-challenge/` must bypass the HTTP→HTTPS redirect or webroot renewal fails.

## Test accounts

See `backend/schema.sql` seed rows (demo accounts, all `Password@123`).
