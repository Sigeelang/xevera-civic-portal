<?php
/*
 * One-shot migration: phone number on pending registrations.
 *
 * - resident_registrations.phone (carried into users.phone on approval)
 *
 * CLI ONLY: php apply_registration_phone.php
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
    $row = $pdo->query("SHOW COLUMNS FROM resident_registrations LIKE 'phone'")->fetch();
    if ($row) {
        $out['steps']['resident_registrations.phone'] = 'already present';
    } else {
        $pdo->exec('ALTER TABLE resident_registrations ADD COLUMN phone VARCHAR(20) DEFAULT NULL AFTER address');
        $out['steps']['resident_registrations.phone'] = 'added';
    }
} catch (Throwable $e) {
    $out['ok'] = false;
    $out['steps']['resident_registrations.phone'] = 'ERROR: ' . $e->getMessage();
}

echo json_encode($out, JSON_PRETTY_PRINT) . PHP_EOL;
exit($out['ok'] ? 0 : 1);
