-- Link announcement notifications back to their announcement so they are clickable.
ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS announcement_id INT DEFAULT NULL AFTER report_id;
