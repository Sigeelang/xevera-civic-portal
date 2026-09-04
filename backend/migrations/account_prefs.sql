-- Xevera Portal: account preferences for the Resident My Account page.
ALTER TABLE notification_prefs ADD COLUMN IF NOT EXISTS email_enabled TINYINT(1) NOT NULL DEFAULT 1 AFTER notify_follow;
ALTER TABLE notification_prefs ADD COLUMN IF NOT EXISTS notify_announcement TINYINT(1) NOT NULL DEFAULT 1 AFTER email_enabled;
