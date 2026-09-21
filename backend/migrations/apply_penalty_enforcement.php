<?php
/*
 * One-shot migration: penalty enforcement columns.
 *
 * - users.suspension_until (suspension windows + automatic lifting)
 * - (violations.penalty_start_at / penalty_end_at are handled by
 *   apply_penalty_schedule.php)
 *
 * CLI ONLY: php apply_penalty_enforcement.php
 * Safe to run multiple times.
 */

if (php_sapi_name() !== 'cli') {
    http_response_code(403);
    echo json_encode(['error' => 'CLI only.']);
    exit;
}

require_once __DIR__ . '/../api/config/database.php';

$out = ['ok' => true, 'steps' => []];

try {
    $row = $pdo->query("SHOW COLUMNS FROM users LIKE 'suspension_until'")->fetch();
    if ($row) {
        $out['steps']['users.suspension_until'] = 'already present';
    } else {
        $pdo->exec('ALTER TABLE users ADD COLUMN suspension_until DATETIME DEFAULT NULL AFTER status');
        $out['steps']['users.suspension_until'] = 'added';
    }
} catch (Throwable $e) {
    $out['ok'] = false;
    $out['steps']['users.suspension_until'] = 'ERROR: ' . $e->getMessage();
}

echo json_encode($out, JSON_PRETTY_PRINT) . PHP_EOL;
exit($out['ok'] ? 0 : 1);
