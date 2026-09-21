<?php
/*
 * One-shot migration: role permission denials table.
 *
 * Stores Super Admin module revocations per role (Admin / Staff).
 * Empty table = pure code behavior. Safe to run multiple times.
 *
 * CLI ONLY: php apply_role_permissions.php
 */

if (php_sapi_name() !== 'cli') {
    http_response_code(403);
    echo json_encode(['error' => 'CLI only.']);
    exit;
}

require_once __DIR__ . '/../api/config/database.php';

$out = ['ok' => true, 'steps' => []];

try {
    $pdo->exec("CREATE TABLE IF NOT EXISTS role_permission_denials (
        role VARCHAR(32) NOT NULL,
        module VARCHAR(64) NOT NULL,
        created_by INT DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (role, module),
        KEY idx_rpd_role (role)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    $out['steps']['role_permission_denials'] = 'ready';
} catch (Throwable $e) {
    $out['ok'] = false;
    $out['steps']['role_permission_denials'] = 'ERROR: ' . $e->getMessage();
}

echo json_encode($out, JSON_PRETTY_PRINT) . PHP_EOL;
exit($out['ok'] ? 0 : 1);
