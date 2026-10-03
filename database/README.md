# Database

## `xevera_civic_database.sql`

Canonical seed: production schema structure (Sydney `xevera-db`),
regenerated 2026-10-05. Replaces the 2026-09-04 phpMyAdmin export.

**Contents:**
- 45 EMPTY tables (structure only — indexes, foreign keys,
  AUTO_INCREMENT values preserved). **Zero real user data.**
- 4 bootstrap logins (password for all: `Admin@123`,
  `must_change_password=1` forces change on first login):
  `super.admin@xevera.gov.ph` (Super Admin),
  `juan.dc@xevera.gov.ph` (Admin),
  `maria.s@xevera.gov.ph` (Staff),
  `juan@email.com` (Resident).
- Target: MySQL 8.4 (RDS). Uses `utf8mb4_0900_ai_ci` on newer tables;
  convert to `utf8mb4_unicode_ci` for MariaDB 10.4 imports.

**Importing (fresh database only):**

```bash
mysql -h <RDS-ENDPOINT> -u <USER> -p'<PASS>' xevera_civic < database/xevera_civic_database.sql
```

**WARNING:** This file contains `DROP TABLE IF EXISTS` per table —
importing drops and recreates same-named tables. Use only on a fresh
schema for clean installs, never against live data you need to keep.
Never commit real user data to this file — the repository is public.

## AWS databases inventory (metadata only — no data leaves AWS)

| Identifier | Account / Region | Purpose | Tables | State |
|---|---|---|---|---|
| `xevera-db` | first AWS `430611185629` / `ap-southeast-2` | Production (real users, reports, OTP) | 45 | available |
| `xevera-database` | new AWS `347076820789` / `ap-southeast-1` | Spare / untouched | 37 | available |
| Snapshots: `xevera-db-predeploy-20260929c/d`, `xevera-db-2-final-20261002` | first AWS / `ap-southeast-2` | Restore points | — | available |

Local mirror copies (never committed, stay on this machine):
`xevera_prod` (45, Sydney prod copy), `xevera_sg` (37, Singapore
copy), `xevera_civic` (37, dev). Full dumps under
`%TEMP%\opencode\db-dumps\` (pristine originals — never edit those;
derive converted copies for old MariaDB imports).
