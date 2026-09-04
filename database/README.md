# Database

## `xevera_civic_database.sql`

phpMyAdmin export of the full `xevera_civic` MySQL database from a
local development instance (MariaDB 10.4). Captured 2026-09-04 14:31.

**Contents:**
- 37 tables: `users`, `reports`, `announcements`, `direct_messages`,
  `notifications`, `contact_messages`, `system_settings`,
  `activity_logs`, `login_history`, `resident_registrations`,
  `report_status_history`, `maintenance_events`, `token_blacklist`,
  `rate_limits`, `community_events`, `service_requests`, `follow_ups`,
  `attendance`, `trusted_devices`, `tasks`, `feedback`, plus 5
  `backup_*` tables from earlier migration runs.
- 19 user accounts, 24 reports, 39 announcements, 201 direct messages,
  265 notifications, 86 contact messages, 4,327 activity log entries.
- All indexes, foreign keys, and AUTO_INCREMENT values preserved.

**Importing into RDS:**

```bash
# From the project root, on the EC2 instance:
scp database/xevera_civic_database.sql ec2-user@<host>:/tmp/
ssh ec2-user@<host>
cd /var/www/xevera/backend
# Use a one-off PHP importer that reads .env and drops+recreates the DB
```

**WARNING:** Importing this file is **destructive** — it drops and
recreates the `xevera_civic` database. Do not run against a database
with live data that you need to keep.

**Note on compatibility:** The export is from MariaDB 10.4. Some
features (e.g. `CHECK (json_valid(...))` clauses) are silently skipped
when imported into MySQL 8.0, but data and structure are preserved.
