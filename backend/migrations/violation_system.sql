-- Violation System Migration
-- Graduated violation tracking with escalating penalties

CREATE TABLE IF NOT EXISTS violations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  resident_id INT NOT NULL,
  report_id INT DEFAULT NULL,
  violation_type ENUM('False Information','Fake Report','Spam Report','Duplicate Report','Abusive Submission') NOT NULL,
  severity ENUM('Minor','Major','Serious','Critical') NOT NULL DEFAULT 'Minor',
  description TEXT,
  evidence TEXT,
  status ENUM('Pending Review','Confirmed','Appealed','Dismissed','Resolved') NOT NULL DEFAULT 'Pending Review',
  penalty_type ENUM('Warning','Reporting Restriction','Fine','Short Suspension','Long Suspension','Indefinite Suspension') DEFAULT NULL,
  penalty_amount DECIMAL(10,2) DEFAULT NULL,
  suspension_days INT DEFAULT NULL,
  restriction_until DATETIME DEFAULT NULL,
  issued_by INT DEFAULT NULL,
  appeal_reason TEXT,
  appeal_date DATETIME DEFAULT NULL,
  appeal_reviewed_by INT DEFAULT NULL,
  appeal_outcome TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (resident_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (report_id) REFERENCES reports(id) ON DELETE SET NULL,
  FOREIGN KEY (issued_by) REFERENCES users(id) ON DELETE SET NULL,
  KEY idx_violations_resident (resident_id),
  KEY idx_violations_status (status),
  KEY idx_violations_report (report_id),
  KEY idx_violations_severity (severity)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS violation_history (
  id INT AUTO_INCREMENT PRIMARY KEY,
  violation_id INT NOT NULL,
  action VARCHAR(50) NOT NULL,
  old_value TEXT,
  new_value TEXT,
  note TEXT,
  acted_by INT DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (violation_id) REFERENCES violations(id) ON DELETE CASCADE,
  FOREIGN KEY (acted_by) REFERENCES users(id) ON DELETE SET NULL,
  KEY idx_vh_violation (violation_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Add violation_count to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS violation_count INT DEFAULT 0;

-- Default penalty configuration
INSERT INTO system_settings (`key`, `value`) VALUES
('violation_penalty_config', '{"Minor":{"warning":true,"fine":100},"Major":{"fine":250,"restriction_days":1},"Serious":{"fine":500,"suspension_days":7},"Critical":{"suspension_days":30}}')
ON DUPLICATE KEY UPDATE `value` = VALUES(`value`);
