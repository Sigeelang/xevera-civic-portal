# Deploy

Production deployment for the Xevera Civic Portal on Amazon Linux 2023 with RDS MariaDB.

## Architecture

| Component | Production setting |
|---|---|
| EC2 | Amazon Linux 2023 |
| Web server | Apache 2.4 + `mod_ssl`, `mod_proxy_fcgi`, `mod_headers`, `mod_rewrite` |
| PHP | PHP 8.5 FPM, socket `/run/php-fpm/www.sock` |
| Database | RDS MariaDB 10.11, private VPC access |
| DB name | `xevera_civic` |
| DB user | `xevera_app` with access from the EC2 security group |
| Frontend | React + Vite, built to `frontend/dist` |
| Backend | PHP API at `/var/www/xevera/backend/api` |
| Uploads | `/var/www/xevera/backend/uploads` |
| Auth signing | `APP_KEY` if set, otherwise `/.xevera_secret` |
| Domain | `xevera-portal.duckdns.org` |
| TLS | Let's Encrypt webroot, certbot timer + Apache reload hook |
| Database backups | RDS manual snapshots + S3 SQL dumps |
| App-data backups | S3 archive of uploads, `.env`, and `.xevera_secret` |

The EC2 instance runs no local MariaDB server in RDS mode. It still installs
MariaDB client tools for connections and dumps.

## Files

- `bootstrap-ec2.sh` - installs packages and services; `--rds` omits the local MariaDB server.
- `deploy.sh` - clones or fast-forwards the repository, builds the app, installs Apache/PHP configs, checks the database, installs the backup timer, and runs smoke tests.
- `configure-env.sh` - interactive creation of `backend/.env` without echoing secrets.
- `php/99-xevera.ini` - PHP upload, memory, and timeout limits.
- `apache/xevera.conf` - HTTP vhost, ACME exemption, API proxy, SPA fallback.
- `apache/xevera-ssl.conf` - HTTPS vhost.
- `apache/xevera-cache.conf` - cache policy for `index.html`, `sw.js`, and hashed assets.
- `letsencrypt/reload-httpd.sh` - certbot deploy hook.
- `db-backup.sh` - MariaDB dump to private S3; works against local MariaDB or RDS.
- `db-restore.sh` - checksum-verified restore; drops and recreates `DB_NAME`.
- `install-db-backup.sh` - installs `/usr/local/sbin/xevera-db-*` and the daily timer.
- `setup-db-backup-aws.sh` - creates the S3 bucket, lifecycle, encryption, bucket write guard, and instance-role policy.
- `systemd/` - daily backup service and timer.

## Before replacing the current instance

The current EC2 instance is still the source of `backend/uploads`, `backend/.env`,
and `/.xevera_secret`. Keep the S3 app-data archive and RDS snapshot until the new
instance is verified.

Useful backup commands:

```bash
# Database dump from the live instance
sudo systemctl start xevera-db-backup.service
sudo journalctl -u xevera-db-backup.service -n 50 --no-pager

# RDS snapshot
aws rds create-db-snapshot \
  --db-instance-identifier xevera-civic-db \
  --db-snapshot-identifier "xevera-civic-db-pre-rebuild-$(date -u +%Y%m%dT%H%M%SZ)"

# App data
sudo tar -C /var/www/xevera -czf /var/tmp/xevera-app-data.tar.gz \
  backend/uploads backend/.env .xevera_secret
aws s3 cp /var/tmp/xevera-app-data.tar.gz \
  "s3://xevera-db-backups/manual/xevera-app-data-$(date -u +%Y%m%dT%H%M%SZ).tar.gz" \
  --sse AES256
```

Do not terminate the old instance until the new one is verified.

## Fresh EC2 instance with RDS

### 1. Launch the instance

Use Amazon Linux 2023, 30 GB gp3, and attach:

- IAM instance profile `InstanceRole`
- Security group allowing inbound `80` and `443`
- No inbound `3306`
- SSM access; SSH is optional

Attach the EC2 security group to the RDS security group's inbound rule. RDS
must not be publicly accessible.

Reuse the Elastic IP if you are replacing an existing server.

### 2. Bootstrap the OS

```bash
sudo dnf install -y git
sudo git clone https://github.com/Sigeelang/xevera-civic-portal.git /var/www/xevera
sudo chown -R apache:apache /var/www/xevera
sudo bash /var/www/xevera/deploy/bootstrap-ec2.sh --rds
```

`bootstrap-ec2.sh --rds`:

- installs Apache, PHP 8.5 FPM, MariaDB client tools, Node 20, Composer, Certbot, and AWS CLI
- sets UTC and enables time sync
- enables `firewalld`, `httpd`, `php-fpm`, and `certbot-renew.timer`
- opens HTTP/HTTPS in firewalld
- does **not** install or start a local MariaDB server

It does **not** restore the database, uploads, `.env`, or `/.xevera_secret`.

### 3. Create or restore secrets

For a new deployment, create `.env` interactively:

```bash
sudo XEVERA_DB_HOST='REPLACE_WITH_RDS_ENDPOINT' \
  bash /var/www/xevera/deploy/configure-env.sh
```

Use the existing `xevera_app` password. Do not create a new app password unless
you also update the RDS user.

For a replacement server, restore the old `.env` and `.xevera_secret` exactly,
then change `DB_HOST` in `.env` to the RDS endpoint:

```text
backend/.env
/.xevera_secret
```

```bash
sudo chown apache:apache /var/www/xevera/backend/.env /var/www/xevera/.xevera_secret
sudo chmod 640 /var/www/xevera/backend/.env /var/www/xevera/.xevera_secret
```

Keep `XEVERA_USE_SECRETS_MANAGER=0` until the `xevera/app` secret contains valid
JSON for this deployment. Do not generate a new `.xevera_secret`; it invalidates
every existing login token.

### 4. Deploy

```bash
sudo bash /var/www/xevera/deploy/deploy.sh
```

Options:

```bash
sudo bash deploy/deploy.sh --skip-build     # reuse dist/ and vendor/
sudo bash deploy/deploy.sh --request-cert  # request TLS if missing
sudo bash deploy/deploy.sh --skip-db       # do not touch or check the database
```

The deploy script is idempotent and safe to rerun. It refuses to update a dirty
Git checkout. A remote `DB_HOST` automatically skips local MariaDB setup.

### 5. Restore the database

Use the RDS master secret. The EC2 instance role must be allowed to read it
(for example, the `XeveraRdsSecrets` inline policy on `InstanceRole`).

```bash
sudo XEVERA_DB_ADMIN_SECRET_ARN='<rds-master-secret-arn>' \
  /usr/local/sbin/xevera-db-restore --yes \
  manual/xevera_civic-YYYYMMDDTHHMMSSZ.sql.gz
```

Without a key, the script selects the newest `.sql.gz` under
`XEVERA_BACKUP_PREFIX` (default `daily`). For manual backups:

```bash
sudo XEVERA_BACKUP_PREFIX=manual \
  XEVERA_DB_ADMIN_SECRET_ARN='<rds-master-secret-arn>' \
  /usr/local/sbin/xevera-db-restore --yes
```

Warning: this **drops and recreates** the database named by `DB_NAME`. The
restore also ensures `xevera_app` exists and has privileges on the restored
database.

### 6. Restore uploads and secrets

```bash
sudo tar -xzf /path/to/xevera-app-data.tar.gz -C /var/www/xevera
sudo chown -R apache:apache \
  /var/www/xevera/backend/uploads \
  /var/www/xevera/backend/.env \
  /var/www/xevera/.xevera_secret
sudo chmod 640 /var/www/xevera/backend/.env /var/www/xevera/.xevera_secret
sudo find /var/www/xevera/backend/uploads -type d -exec chmod 755 {} \;
sudo find /var/www/xevera/backend/uploads -type f -exec chmod 644 {} \;
```

Uploads, `.env`, and `/.xevera_secret` are not stored in Git or RDS. Keep the
S3 app-data archive independent of the database backup. Never upload the
repository or workspace to S3: the bucket policy allows `s3:PutObject` only
under `daily/` and `manual/`, and denies every other prefix.

### 7. Point the domain and issue TLS

If reusing the Elastic IP, associate it with the new instance:

```bash
aws ec2 associate-address \
  --allocation-id 'REPLACE_WITH_ALLOCATION_ID' \
  --instance-id 'REPLACE_WITH_INSTANCE_ID' \
  --allow-reassociation
```

If the certificate does not exist on the new instance:

```bash
sudo bash /var/www/xevera/deploy/deploy.sh --request-cert
```

Or manually:

```bash
sudo certbot certonly --webroot -w /var/www/xevera/frontend/dist \
  -d xevera-portal.duckdns.org --agree-tos -m xeveraportal@gmail.com
sudo systemctl reload httpd
```

Verify renewal:

```bash
sudo certbot renew --dry-run
```

DuckDNS only needs an update if the public IP changes.

## Existing instance update

```bash
sudo bash /var/www/xevera/deploy/deploy.sh
```

If Git reports a dirty worktree, the deploy stops. Inspect and reconcile first:

```bash
sudo -u apache git -C /var/www/xevera status --short
sudo -u apache git -C /var/www/xevera diff
```

Do not run `git pull` as root against an `apache`-owned checkout; use `sudo -u apache`.

## Manual fallback

If the deploy script cannot be used:

```bash
sudo install -m 0644 deploy/apache/xevera.conf /etc/httpd/conf.d/xevera.conf
sudo install -m 0644 deploy/apache/xevera-cache.conf /etc/httpd/conf.d/xevera-cache.conf
sudo install -m 0644 deploy/apache/xevera-ssl.conf /etc/httpd/conf.d/xevera-ssl.conf
sudo install -m 0644 deploy/php/99-xevera.ini /etc/php.d/99-xevera.ini
sudo apachectl configtest
sudo systemctl reload php-fpm httpd
```

Do not install the SSL vhost before the certificate exists; Apache will fail its
configuration test.

## Database backup and restore

Install the timer:

```bash
sudo bash deploy/install-db-backup.sh
```

The timer runs daily at approximately `02:00 UTC` with a randomized delay. It
dumps RDS through the application user and uploads the compressed dump to the
private, versioned, AES256-encrypted S3 bucket. Daily objects expire after 90
days. Manual objects under `manual/` are not expired by that lifecycle rule.
Dumps include tables, routines, triggers, and views. MariaDB events are not
exported because the application user lacks `EVENT`; grant it and add
`--events` if the database starts using events.

Run a backup now:

```bash
sudo systemctl start xevera-db-backup.service
sudo journalctl -u xevera-db-backup.service -n 50 --no-pager
aws s3 ls s3://xevera-db-backups/daily/
```

RDS Free plan retains automated backups for 1 day. Use manual RDS snapshots and
the S3 dumps for longer retention.

## Verification

```bash
sudo systemctl is-active httpd php-fpm firewalld
sudo systemctl is-active certbot-renew.timer xevera-db-backup.timer

sudo apachectl configtest
sudo php-fpm -t
php --ini | grep 99-xevera

curl -I https://xevera-portal.duckdns.org/
curl -I https://xevera-portal.duckdns.org/dashboard
```

Check database counts from the EC2 instance:

```bash
sudo bash -c '
  set -a
  . /var/www/xevera/backend/.env
  set +a
  MYSQL_PWD="$DB_PASS" mysql \
    --host="$DB_HOST" --port="$DB_PORT" --user="$DB_USER" "$DB_NAME" \
    -e "SELECT COUNT(*) AS users FROM users;"
  MYSQL_PWD="$DB_PASS" mysql \
    --host="$DB_HOST" --port="$DB_PORT" --user="$DB_USER" "$DB_NAME" \
    -e "SELECT COUNT(*) AS reports FROM reports;"
  MYSQL_PWD="$DB_PASS" mysql \
    --host="$DB_HOST" --port="$DB_PORT" --user="$DB_USER" "$DB_NAME" \
    -e "SELECT COUNT(*) AS announcements FROM announcements;"
'
```

Also test:

- Resident, Staff, Admin, and Super Admin login
- OTP delivery and verification
- Forgot-password flow
- Report image upload and retrieval
- Announcement image upload
- Manual database backup
- `certbot renew --dry-run`

## Security notes

- Keep `3306` closed in the EC2 security group.
- Allow `3306` to RDS only from the EC2 application security group.
- Keep RDS private; do not enable public access.
- Prefer SSM over public SSH.
- `backend/.env` and `/.xevera_secret` must be mode `0640`, owned by `apache`.
- Uploaded files are served statically and PHP execution is denied under `/uploads`.
- `frontend/dist` should be `0755`, not `0777`.
- Do not commit `.env`, `.xevera_secret`, PEM files, database dumps, SMTP passwords, or the app-data archive.
- Do not put secrets in `VITE_` variables.
- Keep `XEVERA_USE_SECRETS_MANAGER=0` until the `xevera/app` secret is valid.

## Key learnings

1. **`RewriteCond` scope** - only attaches to the immediately following `RewriteRule`.
2. **`%{REQUEST_FILENAME}` in vhost context** - use `%{DOCUMENT_ROOT}%{REQUEST_URI}` for file/dir checks.
3. **`AllowOverride None`** - prevents stale `.htaccess` files from breaking the frontend/API.
4. **ACME exemption** - `/.well-known/acme-challenge/` must bypass the HTTP-to-HTTPS redirect.
5. **Do not install the SSL vhost before the certificate exists** - otherwise `apachectl configtest` fails.
6. **Do not deploy from a dirty checkout** - the script stops instead of overwriting hotfixes.
7. **PHP 8.5, not generic `php`** - install the `php8.5-*` packages used by this app.
8. **RDS, not local MariaDB** - use the RDS endpoint and keep the local server disabled.
9. **Uploads and secrets are not in the DB backup** - back them up separately in the app-data archive.
10. **RDS app user lacks CREATE/DROP** - use the master secret for restores.
