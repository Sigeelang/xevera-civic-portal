-- Xevera Civic Portal Database Schema
-- Import into target database: mysql -u root -p db_name < schema.sql

CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  username VARCHAR(50) DEFAULT NULL,
  password_hash VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  address VARCHAR(255) DEFAULT NULL,
  role ENUM('Super Admin','Admin','Staff','Resident') NOT NULL DEFAULT 'Resident',
  status ENUM('Active','Inactive') NOT NULL DEFAULT 'Active',
  account_prefs LONGTEXT DEFAULT NULL,
  must_change_password TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  profile_photo VARCHAR(255) DEFAULT NULL,
  middle_name VARCHAR(100) DEFAULT NULL,
  phone VARCHAR(20) DEFAULT NULL,
  date_of_birth DATE DEFAULT NULL,
  gender VARCHAR(20) DEFAULT NULL,
  phase VARCHAR(50) DEFAULT NULL,
  block VARCHAR(50) DEFAULT NULL,
  lot VARCHAR(50) DEFAULT NULL,
  last_login_at DATETIME DEFAULT NULL,
  email_verified TINYINT(1) DEFAULT 0,
  verify_token VARCHAR(64) DEFAULT NULL,
  verify_token_expires DATETIME DEFAULT NULL,
  reset_token VARCHAR(64) DEFAULT NULL,
  reset_token_expires DATETIME DEFAULT NULL,
  phone_verified TINYINT(1) DEFAULT 0,
  security_settings LONGTEXT DEFAULT NULL,
  emergency_contact LONGTEXT DEFAULT NULL,
  UNIQUE KEY idx_users_username (username)
);

CREATE TABLE reports (
  id INT AUTO_INCREMENT PRIMARY KEY,
  ref_id VARCHAR(20) NOT NULL UNIQUE,
  title VARCHAR(200) NOT NULL,
  category VARCHAR(100) NOT NULL,
  priority ENUM('Normal','High','Urgent') NOT NULL DEFAULT 'Normal',
  description TEXT NOT NULL,
  location VARCHAR(255) NOT NULL,
  latitude DECIMAL(10,7) DEFAULT NULL,
  longitude DECIMAL(10,7) DEFAULT NULL,
  status ENUM('Pending','Verified','Assigned','In Progress','Resolved','Closed','Rejected') NOT NULL DEFAULT 'Pending',
  verified_at DATETIME DEFAULT NULL,
  verified_by INT DEFAULT NULL,
  assigned_to INT DEFAULT NULL,
  assigned_at DATETIME DEFAULT NULL,
  reporter_name VARCHAR(100) DEFAULT NULL,
  reporter_phone VARCHAR(20) DEFAULT NULL,
  reporter_email VARCHAR(100) DEFAULT NULL,
  reporter_user_id INT DEFAULT NULL,
  photo_paths LONGTEXT DEFAULT NULL,
  likes INT DEFAULT 0,
  comments_count INT DEFAULT 0,
  featured TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  resolved_at DATETIME DEFAULT NULL,
  closed_at DATETIME DEFAULT NULL,
  rejection_reason TEXT DEFAULT NULL,
  remarks TEXT DEFAULT NULL,
  resolution TEXT DEFAULT NULL,
  FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (verified_by) REFERENCES users(id) ON DELETE SET NULL,
  KEY idx_reports_status (status),
  KEY idx_reports_category (category),
  KEY idx_reports_priority (priority),
  KEY idx_reports_created_at (created_at)
);

CREATE TABLE password_history (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  KEY idx_password_history_user (user_id, created_at)
);

CREATE TABLE activity_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT DEFAULT NULL,
  action VARCHAR(100) NOT NULL,
  target_type VARCHAR(50) NOT NULL,
  target_id INT DEFAULT NULL,
  detail TEXT DEFAULT NULL,
  previous_value TEXT DEFAULT NULL,
  new_value TEXT DEFAULT NULL,
  reason TEXT DEFAULT NULL,
  ip_address VARCHAR(45) DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  KEY idx_activity_logs_target (target_type, target_id)
);

CREATE TABLE IF NOT EXISTS rate_limits (
  id INT AUTO_INCREMENT PRIMARY KEY,
  identifier VARCHAR(255) NOT NULL,
  type VARCHAR(20) NOT NULL DEFAULT 'ip',
  endpoint VARCHAR(50) NOT NULL DEFAULT 'report_submit',
  window_start DATETIME NOT NULL,
  INDEX idx_lookup (identifier, type, endpoint, window_start),
  INDEX idx_window_start (window_start)
);

CREATE TABLE IF NOT EXISTS token_blacklist (
  id INT AUTO_INCREMENT PRIMARY KEY,
  jti VARCHAR(64) NOT NULL UNIQUE,
  user_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS otp_verifications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(255) NOT NULL,
  otp_hash VARCHAR(255) NOT NULL,
  purpose VARCHAR(50) NOT NULL,
  expires_at DATETIME NOT NULL,
  attempts INT DEFAULT 0,
  last_sent_at DATETIME DEFAULT NULL,
  verified_at DATETIME DEFAULT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  KEY idx_otp_email_purpose (email, purpose)
);

CREATE TABLE IF NOT EXISTS system_settings (
  `key` VARCHAR(50) PRIMARY KEY,
  `value` TEXT DEFAULT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS report_status_history (
  id INT AUTO_INCREMENT PRIMARY KEY,
  report_id INT NOT NULL,
  old_status VARCHAR(50) NOT NULL,
  new_status VARCHAR(50) NOT NULL,
  acted_by INT NOT NULL,
  note TEXT DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (report_id) REFERENCES reports(id) ON DELETE CASCADE,
  FOREIGN KEY (acted_by) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS report_follows (
  id INT AUTO_INCREMENT PRIMARY KEY,
  report_id INT NOT NULL,
  user_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_report_user (report_id, user_id),
  FOREIGN KEY (report_id) REFERENCES reports(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS report_likes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  report_id INT NOT NULL,
  user_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_report_user_like (report_id, user_id),
  FOREIGN KEY (report_id) REFERENCES reports(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS report_comments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  report_id INT NOT NULL,
  user_id INT NOT NULL,
  comment TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (report_id) REFERENCES reports(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS report_ratings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  report_id INT NOT NULL,
  user_id INT NOT NULL,
  rating TINYINT NOT NULL,
  feedback TEXT DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_report_user_rating (report_id, user_id),
  FOREIGN KEY (report_id) REFERENCES reports(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS announcements (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  author_id INT DEFAULT NULL,
  target_audience ENUM('all','residents','staff') DEFAULT 'all',
  is_pinned TINYINT(1) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS notifications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  report_id INT DEFAULT NULL,
  type VARCHAR(50) NOT NULL,
  message TEXT NOT NULL,
  is_read TINYINT(1) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (report_id) REFERENCES reports(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS notification_prefs (
  user_id INT PRIMARY KEY,
  notify_status TINYINT(1) DEFAULT 1,
  notify_assignment TINYINT(1) DEFAULT 1,
  notify_comment TINYINT(1) DEFAULT 1,
  notify_like TINYINT(1) DEFAULT 1,
  notify_followup TINYINT(1) DEFAULT 1,
  notify_announcement TINYINT(1) DEFAULT 1,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS direct_messages (
  id INT AUTO_INCREMENT PRIMARY KEY,
  sender_id INT NOT NULL,
  recipient_id INT NOT NULL,
  message TEXT NOT NULL,
  is_read TINYINT(1) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (recipient_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS community_events (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  location VARCHAR(255),
  start_datetime DATETIME NOT NULL,
  end_datetime DATETIME DEFAULT NULL,
  organizer_id INT DEFAULT NULL,
  max_attendees INT DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (organizer_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS event_rsvps (
  id INT AUTO_INCREMENT PRIMARY KEY,
  event_id INT NOT NULL,
  user_id INT NOT NULL,
  status ENUM('going','interested','not_going') DEFAULT 'going',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_event_user (event_id, user_id),
  FOREIGN KEY (event_id) REFERENCES community_events(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS contact_messages (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(255) NOT NULL,
  subject VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  status ENUM('open','in_progress','closed') DEFAULT 'open',
  assigned_to INT DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS contact_message_replies (
  id INT AUTO_INCREMENT PRIMARY KEY,
  message_id INT NOT NULL,
  user_id INT NOT NULL,
  reply TEXT NOT NULL,
  is_internal TINYINT(1) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (message_id) REFERENCES contact_messages(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS feedback (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT DEFAULT NULL,
  rating TINYINT NOT NULL,
  comment TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS follow_ups (
  id INT AUTO_INCREMENT PRIMARY KEY,
  report_id INT NOT NULL,
  user_id INT NOT NULL,
  action TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (report_id) REFERENCES reports(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS service_requests (
  id INT AUTO_INCREMENT PRIMARY KEY,
  resident_id INT NOT NULL,
  service_type VARCHAR(100) NOT NULL,
  description TEXT,
  status ENUM('pending','approved','rejected','completed') DEFAULT 'pending',
  assigned_to INT DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (resident_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS tasks (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  assigned_to INT DEFAULT NULL,
  created_by INT DEFAULT NULL,
  status ENUM('pending','in_progress','completed','cancelled') DEFAULT 'pending',
  priority ENUM('low','normal','high','urgent') DEFAULT 'normal',
  due_date DATETIME DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS attendance (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  date DATE NOT NULL,
  time_in DATETIME DEFAULT NULL,
  time_out DATETIME DEFAULT NULL,
  status ENUM('present','late','absent','half_day') DEFAULT 'present',
  location VARCHAR(255) DEFAULT NULL,
  notes TEXT DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_user_date (user_id, date),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS attendance_corrections (
  id INT AUTO_INCREMENT PRIMARY KEY,
  attendance_id INT NOT NULL,
  user_id INT NOT NULL,
  requested_time_in DATETIME DEFAULT NULL,
  requested_time_out DATETIME DEFAULT NULL,
  reason TEXT,
  status ENUM('pending','approved','rejected') DEFAULT 'pending',
  reviewed_by INT DEFAULT NULL,
  reviewed_at DATETIME DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (attendance_id) REFERENCES attendance(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS maintenance_events (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  scheduled_at DATETIME NOT NULL,
  duration_minutes INT DEFAULT 60,
  created_by INT DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS login_history (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  browser VARCHAR(100) DEFAULT NULL,
  os VARCHAR(50) DEFAULT NULL,
  device VARCHAR(50) DEFAULT NULL,
  ip VARCHAR(45) DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

INSERT INTO users (name, username, password_hash, email, role, status) VALUES
('Super Admin', 'super.admin', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'super.admin@xevera.gov.ph', 'Super Admin', 'Active'),
('Juan Dela Cruz', 'juan.dc', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'juan.dc@xevera.gov.ph', 'Admin', 'Active'),
('Maria Santos', 'maria.s', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'maria.s@xevera.gov.ph', 'Staff', 'Active'),
('Ana Cruz', 'ana.cruz', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'ana.cruz@xevera.gov.ph', 'Staff', 'Active'),
('Pedro Reyes', 'pedro.reyes', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'pedro.reyes@xevera.gov.ph', 'Staff', 'Inactive');

INSERT INTO users (name, username, password_hash, email, address, role, status) VALUES
('Maria Santos', 'maria.santos', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'maria@email.com', 'Block 3, Phase 1, Xevera', 'Resident', 'Active'),
('Juan Resident', NULL, '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'juan@email.com', 'Block 5, Phase 2, Xevera', 'Resident', 'Active'),
('Ana Reyes', 'ana.reyes', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'ana@email.com', 'Block 2, Phase 3, Xevera', 'Resident', 'Active'),
('Hanz', 'hanz', '$2y$10$/NnRjcW2vTKBLbUHwbpbnuMddx5EUuNi94hRhchiDYhY92Jcpi7Aq', 'hanz@gmail.com', '', 'Resident', 'Active');

INSERT INTO system_settings (`key`, `value`) VALUES
('site_name', 'Xevera Portal'),
('contact_email', 'civicdesk@xevera.gov.ph'),
('contact_phone', '(02) 8123-4567'),
('barangay_address', 'Barangay Hall, San Isidro, Xevera'),
('hero_title', 'Building a Better Xevera Together'),
('hero_subtitle', 'Report environmental and civic issues in your community and track how the local team responds — from submission all the way to resolution.'),
('categories', '["Flooding","Road Damage","Garbage / Waste","Streetlight","Water Problem","Drainage","Environmental","Public Safety","Other Issues"]'),
('reports_per_page', '4'),
('max_photos', '3'),
('max_file_size_mb', '5'),
('rate_limit_anon', '3'),
('rate_limit_auth', '10'),
('registration_enabled', '1'),
('maintenance_mode', '0'),
('maintenance_title', 'We\'ll Be Back Soon!'),
('maintenance_headline', 'Website Under Maintenance'),
('maintenance_message', ''),
('maintenance_description', 'Our team is currently improving the system. Thank you for your patience.'),
('maintenance_footer', 'Thank you for your patience and understanding.'),
('maintenance_enabled_by', 'manual_off'),
('maintenance_scheduled_at', ''),
('maintenance_allowed_roles', '["Super Admin","Admin"]'),
('maintenance_notifications', '{"notify_staff":true,"reason":true,"email_admin":true,"emergency_contact":false,"estimated_completion":true,"countdown":true}'),
('system_version', 'v2.4.1'),
('smtp_last_tested_at', ''),
('twofa_enabled', '0'),
('twofa_method', 'SMS OTP'),
('twofa_roles', '["Staff"]'),
('hero_banner', '');

INSERT INTO activity_logs (user_id, action, target_type, target_id, detail) VALUES
(NULL, 'system_init', 'system', NULL, 'Database initialized with sample data');