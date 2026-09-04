-- =====================================================================
-- Xevera auth/security v2 -- Phase 0 (schema only, no runtime change)
-- =====================================================================
-- Idempotent. Apply once via phpMyAdmin or `mysql ... < 10000_auth_v2.sql`.
-- Intentionally does NOT change any existing column, table, or helper.
-- It only ADDS:
--   * sessions              : server-side session store
--   * trusted_devices       : remembered-device bypass for 2FA
--   * rate_limit_policies   : per-endpoint / per-role limits
--   * system_settings rows  : idle/absolute session, per-role TTL, step-up
--
-- Re-runs are safe: every CREATE uses IF NOT EXISTS and every seed is
-- INSERT IGNORE. There is no DROP and no destructive ALTER.
-- =====================================================================

SET NAMES utf8mb4;

-- ---------------------------------------------------------------------
-- 1. Server-side session store
-- ---------------------------------------------------------------------
-- One row per issued session. The session_id_hash is sha256(opaqueToken)
-- (never the raw token). This row is the source of truth for "is this
-- session currently valid?" and replaces the 7-day exp-only token check
-- that is currently in xevera_issue_session().
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sessions (
  id                  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id             INT NOT NULL,
  session_id_hash     CHAR(64) NOT NULL,
  scope               VARCHAR(16) NOT NULL DEFAULT 'portal',
  ip                  VARCHAR(64) NULL,
  user_agent          VARCHAR(255) NULL,
  -- Cached client hint ("portal" cookie-bound browser or "bearer" header).
  -- Never trusted for security decisions; only used for the active-sessions
  -- list so the user can recognise the device.
  auth_mode           VARCHAR(16) NOT NULL DEFAULT 'unknown',
  created_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_activity_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  -- Idle expiry: 15 min after last_activity_at.
  expires_at          DATETIME NOT NULL,
  -- Absolute expiry: 12 h after created_at regardless of activity.
  absolute_expires_at DATETIME NOT NULL,
  -- Set when the session is revoked by logout, password change,
  -- "sign out of all devices", or admin action.
  revoked_at          DATETIME NULL,
  revoked_reason      VARCHAR(64) NULL,
  -- Optional FK to trusted_devices (NULL = no trusted device used).
  trusted_device_id   BIGINT UNSIGNED NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_sessions_hash (session_id_hash),
  KEY idx_sessions_user_active (user_id, revoked_at, expires_at),
  KEY idx_sessions_trusted (trusted_device_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------------------
-- 2. Trusted devices
-- ---------------------------------------------------------------------
-- Stores only a SHA-256 hash of the opaque device token (same convention
-- as sessions). The raw token lives only in the user's HttpOnly cookie.
-- Geo is intentionally NOT stored -- the design prohibits persisting
-- approximate geographic location by default.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS trusted_devices (
  id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id       INT NOT NULL,
  token_hash    CHAR(64) NOT NULL,
  -- Browser + OS only (set by server from User-Agent). Optional user label.
  browser_os    VARCHAR(64) NULL,
  label         VARCHAR(64) NULL,
  ip            VARCHAR(64) NULL,
  user_agent    VARCHAR(255) NULL,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_used_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at    DATETIME NOT NULL,
  revoked_at    DATETIME NULL,
  revoked_reason VARCHAR(64) NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_trusted_token (token_hash),
  KEY idx_trusted_user (user_id, revoked_at, expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------------------
-- 3. Rate-limit policy table
-- ---------------------------------------------------------------------
-- Lets Phase 5 wire endpoint+role limits without code changes.
-- Phase 0 only seeds defaults; nothing reads this table yet.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS rate_limit_policies (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  endpoint        VARCHAR(64) NOT NULL,
  role            VARCHAR(32) NOT NULL DEFAULT '',  -- '' = applies to all roles
  identifier_kind VARCHAR(16) NOT NULL DEFAULT 'ip_user',  -- ip_user | ip | user | email
  max_requests    INT NOT NULL,
  window_seconds  INT NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_rate_limit_endpoint_role (endpoint, role)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT IGNORE INTO rate_limit_policies (endpoint, role, identifier_kind, max_requests, window_seconds) VALUES
  ('auth/login',            '',         'ip_user', 5,    900),   -- 5 / 15 min
  ('auth/verify-login-otp', '',         'email',    5,    600),   -- 5 / OTP lifetime
  ('auth/resend-otp',       '',         'email',    3,    900),   -- 3 / 15 min
  ('auth/forgot',           '',         'ip_user',  3,    3600),  -- 3 / hour
  ('auth/signout-all',      '',         'user',     3,    3600),  -- 3 / hour
  ('contact/create',        '',         'ip_user',  5,    3600),  -- 5 / hour
  ('reports/create',        '',         'user',     10,   3600),  -- 10 / hour
  ('direct_messages/send',  '',         'user',     20,   3600),  -- 20 / hour
  ('trusted_devices/create', '',        'user',     3,    86400), -- 3 / 24h
  ('settings/save',         'Super Admin','user',    30,   3600);  -- Super Admin settings churn

-- ---------------------------------------------------------------------
-- 4. Step-up freshness claim on sessions
-- ---------------------------------------------------------------------
-- We piggyback on the existing `sessions` row to remember when the
-- Super Admin last passed a fresh OTP for a sensitive action. Two columns
-- track (a) the most recent successful OTP verification and (b) which
-- action class it covers, so Phase 4 can require a re-verify for a
-- different class without re-prompting for the same one.
-- Phase 0 only ADDS the columns; no code reads or writes them yet.
-- ---------------------------------------------------------------------
-- Note: MySQL/MariaDB don't support `ADD COLUMN IF NOT EXISTS` on every
-- server version, so we use the information_schema guard pattern.
SET @col_exists := (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name   = 'sessions'
    AND column_name  = 'stepup_at'
);
SET @ddl := IF(@col_exists = 0,
  'ALTER TABLE sessions ADD COLUMN stepup_at DATETIME NULL AFTER revoked_reason',
  'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists := (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name   = 'sessions'
    AND column_name  = 'stepup_action'
);
SET @ddl := IF(@col_exists = 0,
  'ALTER TABLE sessions ADD COLUMN stepup_action VARCHAR(32) NULL AFTER stepup_at',
  'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ---------------------------------------------------------------------
-- 5. system_settings seeds (safe defaults, INSERT IGNORE)
-- ---------------------------------------------------------------------
-- Keys are inert in Phase 0 -- nothing reads them yet. They become live
-- in Phase 1 (server-side sessions) and Phase 4 (per-role + step-up).
-- ---------------------------------------------------------------------
INSERT IGNORE INTO system_settings (`key`, `value`) VALUES
  -- Server-side session policy
  ('session_idle_minutes',           '15'),    -- rolling inactivity window
  ('session_absolute_hours',         '12'),    -- hard cap, regardless of activity
  -- Trusted device TTLs (per role)
  ('trusted_device_days_resident',   '15'),
  ('trusted_device_days_staff',      '15'),
  ('trusted_device_days_admin',      '7'),
  ('trusted_device_days_super_admin','0'),     -- 0 = no trusted-device bypass
  -- Super Admin step-up
  ('superadmin_stepup_actions',
   'role_change,permission_change,credential_change,security_settings,2fa_policy,backup_restore'),
  ('superadmin_stepup_window_minutes',         '10'),
  ('superadmin_stepup_window_backup_minutes',  '2');
