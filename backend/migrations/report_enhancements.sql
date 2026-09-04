-- Xevera Portal: report enhancements (verification, coordinates) + community events
ALTER TABLE reports
  ADD COLUMN IF NOT EXISTS verified_at DATETIME DEFAULT NULL AFTER status,
  ADD COLUMN IF NOT EXISTS latitude DECIMAL(10,7) DEFAULT NULL AFTER location,
  ADD COLUMN IF NOT EXISTS longitude DECIMAL(10,7) DEFAULT NULL AFTER latitude;

CREATE TABLE IF NOT EXISTS community_events (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  location VARCHAR(255),
  category VARCHAR(50) DEFAULT 'General',
  starts_at DATETIME,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO community_events (title, description, location, category, starts_at)
SELECT 'Barangay Clean-Up Drive', 'Join volunteers for a community cleanup across Phase 1 blocks.', 'Xevera Commons', 'Environment', '2026-08-15 08:00:00'
WHERE NOT EXISTS (SELECT 1 FROM community_events WHERE title = 'Barangay Clean-Up Drive');

INSERT INTO community_events (title, description, location, category, starts_at)
SELECT 'Health & Wellness Checkup', 'Free basic health checkups and consultations for residents.', 'Xevera Hall', 'Health', '2026-08-18 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM community_events WHERE title = 'Health & Wellness Checkup');

INSERT INTO community_events (title, description, location, category, starts_at)
SELECT 'Community Fundraiser', 'Support local youth programs through a neighborhood fundraiser.', 'Athletic Field', 'Community', '2026-08-22 17:00:00'
WHERE NOT EXISTS (SELECT 1 FROM community_events WHERE title = 'Community Fundraiser');

-- Curated report categories (idempotent)
INSERT INTO system_settings (`key`, `value`) VALUES ('categories', '["Road","Flood","Garbage","Illegal Parking","Streetlight","Water Leak","Drainage","Noise","Trees","Others"]')
ON DUPLICATE KEY UPDATE `value` = VALUES(`value`);