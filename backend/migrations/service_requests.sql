-- Service Requests migration
CREATE TABLE IF NOT EXISTS service_requests (
  id INT AUTO_INCREMENT PRIMARY KEY,
  ref_id VARCHAR(20) NOT NULL UNIQUE,
  title VARCHAR(200) NOT NULL,
  category VARCHAR(80) DEFAULT NULL,
  location VARCHAR(190) DEFAULT NULL,
  resident_name VARCHAR(120) DEFAULT NULL,
  resident_email VARCHAR(190) DEFAULT NULL,
  resident_phone VARCHAR(30) DEFAULT NULL,
  priority ENUM('Low','Normal','High','Urgent') NOT NULL DEFAULT 'Normal',
  status ENUM('Pending','Assigned','In Progress','Completed','Cancelled') NOT NULL DEFAULT 'Pending',
  assigned_to INT DEFAULT NULL,
  notes TEXT DEFAULT NULL,
  is_demo TINYINT(1) NOT NULL DEFAULT 0,
  created_by INT DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_status (status),
  KEY idx_priority (priority),
  KEY idx_assigned (assigned_to),
  FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Guarded demo seed (only when the table is empty); flagged is_demo=1 for safe removal later.
INSERT INTO service_requests (ref_id, title, category, location, resident_name, resident_email, resident_phone, priority, status, assigned_to, notes, is_demo)
SELECT * FROM (
  SELECT 'SR-0001' AS ref_id, 'Barangay Clearance Document Request' AS title, 'Document Request' AS category, 'Xevera Phase 1, Block 5' AS location,
         'Maria Santos' AS resident_name, 'maria.s@xevera.gov.ph' AS resident_email, '09171234567' AS resident_phone,
         'Normal' AS priority, 'Pending' AS status, NULL AS assigned_to,
         'Demo seed record - safe to delete.' AS notes, 1 AS is_demo
  UNION ALL
  SELECT 'SR-0002', 'Streetlight Repair at Phase 2 corner', 'Streetlight', 'Phase 2, near Gate B',
         'Juan Dela Cruz', 'juan.dc@xevera.gov.ph', '09182345678',
         'High', 'Assigned', (SELECT id FROM users WHERE email = 'juan.dc@xevera.gov.ph' LIMIT 1),
         'Demo seed record - safe to delete.', 1
  UNION ALL
  SELECT 'SR-0003', 'Waste Collection Request', 'Waste', 'Phase 3, Block 9',
         'Ana Cruz', 'ana.cruz@xevera.gov.ph', '09193456789',
         'Normal', 'Completed', (SELECT id FROM users WHERE email = 'maria.s@xevera.gov.ph' LIMIT 1),
         'Demo seed record - safe to delete.', 1
) AS s
WHERE NOT EXISTS (SELECT 1 FROM service_requests);