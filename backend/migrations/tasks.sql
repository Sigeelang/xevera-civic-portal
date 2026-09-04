-- Staff task board migration
CREATE TABLE IF NOT EXISTS tasks (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(200) NOT NULL,
  description TEXT DEFAULT NULL,
  `column` ENUM('To Do','In Progress','Done') NOT NULL DEFAULT 'To Do',
  priority ENUM('Low','Normal','High','Urgent') NOT NULL DEFAULT 'Normal',
  assigned_to INT DEFAULT NULL,
  due_date DATE DEFAULT NULL,
  created_by INT DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_column (`column`),
  KEY idx_assigned (assigned_to),
  KEY idx_due (due_date),
  FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;