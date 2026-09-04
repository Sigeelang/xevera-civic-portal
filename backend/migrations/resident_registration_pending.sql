-- Pending resident registrations: accounts are created in `users`
-- ONLY after email OTP verification (see auth/complete-registration.php).
CREATE TABLE IF NOT EXISTS resident_registrations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  username VARCHAR(50) NOT NULL,
  email VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  address VARCHAR(255) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_pending_email (email),
  KEY idx_pending_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
