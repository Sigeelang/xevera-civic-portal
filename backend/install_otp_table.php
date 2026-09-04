<?php
// CLI-only installer. Blocked from web access by router.php and .htaccess.
if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit('Not found');
}

require_once __DIR__ . '/api/config/env.php';

$pdo = new PDO(
    sprintf('mysql:host=%s;port=%s;dbname=%s', getenv('DB_HOST') ?: 'localhost', getenv('DB_PORT') ?: '3306', getenv('DB_NAME') ?: 'xevera_civic'),
    getenv('DB_USER') ?: 'root',
    (string) getenv('DB_PASS')
);
$pdo->exec("
CREATE TABLE IF NOT EXISTS otp_verifications (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) NOT NULL,
    otp_hash VARCHAR(255) NOT NULL,
    purpose VARCHAR(50) NOT NULL,
    expires_at DATETIME NOT NULL,
    attempts INT DEFAULT 0,
    last_sent_at DATETIME NULL,
    verified_at DATETIME NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_email_purpose (email, purpose)
);"
);
echo "Table created successfully";