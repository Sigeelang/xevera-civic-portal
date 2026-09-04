ALTER TABLE users ADD COLUMN google_id VARCHAR(255) DEFAULT NULL AFTER email_verified, ADD UNIQUE KEY idx_users_google_id (google_id);
