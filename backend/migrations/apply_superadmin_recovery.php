<?php
/*
 * One-shot migration: Super Admin emergency recovery codes.
 *
 * Stores pre-authorized recovery credentials for the standalone
 * /system-aut portal. Only bcrypt hashes are stored — plaintext codes
 * are shown ONCE by the CLI generator and can never be retrieved.
 *
 * A code is usable when used_at IS NULL and expires_at is in the
 * future. Codes are minted/revoked via backend/scripts/
 * generate-recovery-code.php (CLI only). Safe to run multiple times.
 *
 * CLI ONLY: php apply_superadmin_recovery.php
 */

if (php_sapi_name() !== 'cli') {
    http_response_code(403);
    echo json_encode(['error' => 'CLI only.']);
    exit;
}

require_once __DIR__ . '/../api/config/database.php';

$out = ['ok' => true, 'steps' => []];

try {
    $pdo->exec("CREATE TABLE IF NOT EXISTS superadmin_recovery_codes (
        id INT AUTO_INCREMENT PRIMARY KEY,
        email VARCHAR(255) NOT NULL,
        code_hash VARCHAR(255) NOT NULL,
        expires_at DATETIME NOT NULL,
        used_at DATETIME NULL DEFAULT NULL,
        attempts INT NOT NULL DEFAULT 0,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        KEY idx_sar_email (email),
        KEY idx_sar_expiry (expires_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    $out['steps']['superadmin_recovery_codes'] = 'ready';
} catch (Throwable $e) {
    $out['ok'] = false;
    $out['steps']['superadmin_recovery_codes'] = 'ERROR: ' . $e->getMessage();
}

echo json_encode($out, JSON_PRETTY_PRINT) . PHP_EOL;
exit($out['ok'] ? 0 : 1);
