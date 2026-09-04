-- Xevera Portal: consolidated schema completion (idempotent).
-- Adds the tables/columns that the application code already expects but
-- were missing from schema.sql and the earlier migrations.

-- Reports: link back to the reporting account, featured flag, expanded statuses.
ALTER TABLE reports ADD COLUMN IF NOT EXISTS reporter_user_id INT DEFAULT NULL AFTER reporter_email;
ALTER TABLE reports ADD COLUMN IF NOT EXISTS featured TINYINT(1) NOT NULL DEFAULT 0 AFTER status;
ALTER TABLE reports MODIFY COLUMN status ENUM('Pending','Claimed','Resolved','Rejected','Verified') NOT NULL DEFAULT 'Pending';

-- Users: force a password change on first login for known-default accounts.
ALTER TABLE users ADD COLUMN IF NOT EXISTS must_change_password TINYINT(1) NOT NULL DEFAULT 0 AFTER status;

-- Public interactions
CREATE TABLE IF NOT EXISTS report_likes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  report_id INT NOT NULL,
  user_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_like (report_id, user_id),
  KEY idx_like_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS report_follows (
  id INT AUTO_INCREMENT PRIMARY KEY,
  report_id INT NOT NULL,
  user_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_follow (report_id, user_id),
  KEY idx_follow_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS report_comments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  report_id INT NOT NULL,
  user_id INT DEFAULT NULL,
  comment TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  KEY idx_comment_report (report_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS notifications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  report_id INT DEFAULT NULL,
  type VARCHAR(32) NOT NULL DEFAULT 'status',
  message TEXT,
  is_read TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_notif_user (user_id, is_read),
  KEY idx_notif_report (report_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Residents on the running install were created before this column existed.
INSERT IGNORE INTO system_settings (`key`, `value`) VALUES
  ('registration_enabled', '1'),
  ('rate_limit_anon', '3'),
  ('rate_limit_auth', '10');