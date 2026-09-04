-- Xevera Portal: per-user account preferences for Staff personal settings.
ALTER TABLE users ADD COLUMN IF NOT EXISTS account_prefs JSON NULL AFTER status;
