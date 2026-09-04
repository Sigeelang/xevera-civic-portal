-- Xevera Portal: password reset + email verification support (idempotent).
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS verify_token VARCHAR(64) DEFAULT NULL AFTER email_verified,
  ADD COLUMN IF NOT EXISTS verify_token_expires DATETIME DEFAULT NULL AFTER verify_token,
  ADD COLUMN IF NOT EXISTS reset_token VARCHAR(64) DEFAULT NULL AFTER verify_token_expires,
  ADD COLUMN IF NOT EXISTS reset_token_expires DATETIME DEFAULT NULL AFTER reset_token;
