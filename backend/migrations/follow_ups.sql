-- Follow-ups migration
-- Strictly links to an existing report or resident concern (no duplicate systems).
CREATE TABLE IF NOT EXISTS follow_ups (
  id INT AUTO_INCREMENT PRIMARY KEY,
  ref_id VARCHAR(20) NOT NULL UNIQUE,
  title VARCHAR(200) NOT NULL,
  related_type ENUM('report','concern') NOT NULL,
  related_id INT UNSIGNED NOT NULL,
  due_date DATE DEFAULT NULL,
  owner_id INT DEFAULT NULL,
  priority ENUM('Low','Normal','High','Urgent') NOT NULL DEFAULT 'Normal',
  status ENUM('Pending','Waiting','Completed') NOT NULL DEFAULT 'Pending',
  notes TEXT DEFAULT NULL,
  is_demo TINYINT(1) NOT NULL DEFAULT 0,
  created_by INT DEFAULT NULL,
  completed_at DATETIME DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_status (status),
  KEY idx_due (due_date),
  KEY idx_owner (owner_id),
  KEY idx_related (related_type, related_id),
  FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Guarded demo seed (only when the table is empty); links to real existing reports;
-- flagged is_demo=1 for safe removal later.
INSERT INTO follow_ups (ref_id, title, related_type, related_id, due_date, owner_id, priority, status, notes, is_demo, completed_at)
SELECT * FROM (
  SELECT 'FU-0001' AS ref_id, 'Confirm waste pickup completion' AS title, 'report' AS related_type,
         (SELECT id FROM reports WHERE ref_id = 'XR-2026-001000' LIMIT 1) AS related_id,
         DATE_SUB(CURDATE(), INTERVAL 1 DAY) AS due_date,
          (SELECT id FROM users WHERE email = 'xeveraadmin@gmail.com' LIMIT 1) AS owner_id,
         'High' AS priority, 'Pending' AS status,
         'Demo seed record - safe to delete.' AS notes, 1 AS is_demo, NULL AS completed_at
  UNION ALL
  SELECT 'FU-0002', 'Call resident about streetlight repair', 'report',
         (SELECT id FROM reports WHERE ref_id = 'XR-2026-001001' LIMIT 1),
         CURDATE(),
         (SELECT id FROM users WHERE email = 'maria.s@xevera.gov.ph' LIMIT 1),
         'Normal', 'Waiting',
         'Demo seed record - safe to delete.', 1, NULL
  UNION ALL
  SELECT 'FU-0003', 'Verify flood report resolution', 'report',
         (SELECT id FROM reports WHERE ref_id = 'XR-2026-001011' LIMIT 1),
         DATE_SUB(CURDATE(), INTERVAL 3 DAY),
          (SELECT id FROM users WHERE email = 'xeveraadmin@gmail.com' LIMIT 1),
         'Normal', 'Completed',
         'Demo seed record - safe to delete.', 1, DATE_SUB(NOW(), INTERVAL 2 DAY)
) AS s
WHERE NOT EXISTS (SELECT 1 FROM follow_ups);