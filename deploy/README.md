# Deploy

Production deployment artifacts for the Xevera Civic Portal.

## Files

- `apache/xevera.conf` — Apache vhost configuration. Drop into `/etc/httpd/conf.d/`.
  - Uses first-match-wins rewrite pattern.
  - In vhost context, `%{REQUEST_FILENAME}` is the URL path; use `%{DOCUMENT_ROOT}%{REQUEST_URI}` for file/dir checks.
  - Sets `AllowOverride None` on the frontend dist directory to prevent `.htaccess` interference.
- `deploy.sh` — One-shot deploy script (clones repo, builds, reloads Apache).

## Manual deploy steps (already done on `i-00fc46bde3a41c34b`)

```bash
# 1. Copy vhost
sudo cp deploy/apache/xevera.conf /etc/httpd/conf.d/xevera.conf
sudo apachectl configtest
sudo systemctl reload httpd

# 2. Verify
curl -I http://52.64.159.85/                          # 200, 662 bytes, text/html
curl -I http://52.64.159.85/assets/index-*.js         # 200, ~1.7MB, application/javascript
curl -X POST http://52.64.159.85/api/auth/login.php \
  -H "Content-Type: application/json" \
  -d '{"email":"maria.s@xevera.gov.ph","password":"Password@123"}'
# 200, ~598 bytes, application/json with token
```

## Key learnings (do not regress)

1. **`RewriteCond` scope** — only attaches to the IMMEDIATELY following `RewriteRule`. Use a first-match-wins chain with `[L]` flags.
2. **`%{REQUEST_FILENAME}` in vhost context** — this is the URL path, not the filesystem path. Use `%{DOCUMENT_ROOT}%{REQUEST_URI}` for `-f`/`-d` checks.
3. **`AllowOverride None`** — on the frontend dist directory, prevents any stale `.htaccess` from a build artifact from breaking the vhost rules.
4. **ServerAlias the Elastic IP** — so the bare IP works before DNS is set up.

## Test accounts (RDS)

- Resident: `juan@email.com` / `Password@123`
- Staff: `maria.s@xevera.gov.ph` / `Password@123`
- Admin: `juan.dc@xevera.gov.ph` / `Password@123`
- Super Admin: `xeveraportal@gmail.com` / `Password@123`
