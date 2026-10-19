# Database

## `xevera_civic_database.sql`

Canonical seed: production schema structure (Sydney `xevera-db`),
regenerated 2026-10-05. Replaces the 2026-09-04 phpMyAdmin export.

**Contents:**
- 45 EMPTY tables (structure only — indexes, foreign keys,
  AUTO_INCREMENT values preserved). **Zero rows, zero user accounts.**
- Target: MariaDB 10.5+ (EC2) and MySQL 8.x (RDS). Collations normalized
  to `utf8mb4_general_ci` so the same file imports on both.

**Creating the first admin (one-time, after a fresh import):**

```bash
# 1. Generate a bcrypt hash (on the server):
php -r "echo password_hash('ChooseAStrongPassword123', PASSWORD_BCRYPT), PHP_EOL;"
# 2. Insert the Super Admin row (single quotes outside keep $ literal):
mysql -h <RDS-ENDPOINT> -u <DB-USER> -p'<DB-PASS>' -e 'INSERT INTO xevera_civic.users (name, username, password_hash, email, role, status, must_change_password, email_verified) VALUES ("Super Admin", "super.admin", "<HASH-FROM-STEP-1>", "<ADMIN-EMAIL>", "Super Admin", "Active", 1, 1);'
# 3. Log in, then change the password immediately (forced by must_change_password=1).
```
Never commit real user data to this file — the repository is public.

**Importing (fresh database only):**

```bash
# EC2-local MariaDB (current deployment)
mysql -h 127.0.0.1 -u xevera_app -p'<PASS>' xevera_civic < database/xevera_civic_database.sql
```

**WARNING:** This file contains `DROP TABLE IF EXISTS` per table —
importing drops and recreates same-named tables. Use only on a fresh
schema for clean installs, never against live data you need to keep.
Never commit real user data to this file — the repository is public.

## AWS databases inventory (metadata only — no data leaves AWS)

| Identifier | Account / Region | Purpose | Tables | State |
|---|---|---|---|---|
| EC2-local MariaDB (`i-0879974ee4dd87f27`) | new AWS `347076820789` / `ap-southeast-1` | Live portal DB (`xevera_civic`, user `xevera_app`) | 45 | running |
| `xevera-db` | first AWS `430611185629` / `ap-southeast-2` | Legacy production (credentials no longer valid) | 45 | unknown |

Local mirror copies (never committed, stay on this machine):
`xevera_prod` (45, Sydney prod copy), `xevera_sg` (37, Singapore
copy), `xevera_civic` (32, dev). Full dumps under
`%TEMP%\opencode\db-dumps\` (pristine originals — never edit those;
derive converted copies for old MariaDB imports).
