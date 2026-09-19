-- Fake report detection: add suspicious flags and IP tracking to reports
ALTER TABLE `reports`
  ADD COLUMN `is_suspicious` tinyint(1) NOT NULL DEFAULT 0 AFTER `featured`,
  ADD COLUMN `suspicion_reason` varchar(255) DEFAULT NULL AFTER `is_suspicious`,
  ADD COLUMN `ip_address` varchar(45) DEFAULT NULL AFTER `suspicion_reason`;

CREATE INDEX idx_reports_suspicious ON reports(is_suspicious);
CREATE INDEX idx_reports_ip ON reports(ip_address);
