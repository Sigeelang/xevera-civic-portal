<?php
/*
 * One-shot migration: second proof-of-residency image.
 *
 * - users.residency_proof2 (optional second proof image)
 *
 * CLI ONLY: php apply_proof_documents.php
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
    $row = $pdo->query("SHOW COLUMNS FROM users LIKE 'residency_proof2'")->fetch();
    if ($row) {
        $out['steps']['users.residency_proof2'] = 'already present';
    } else {
        $pdo->exec('ALTER TABLE users ADD COLUMN residency_proof2 VARCHAR(255) DEFAULT NULL AFTER residency_proof');
        $out['steps']['users.residency_proof2'] = 'added';
    }
} catch (Throwable $e) {
    $out['ok'] = false;
    $out['steps']['users.residency_proof2'] = 'ERROR: ' . $e->getMessage();
}

echo json_encode($out, JSON_PRETTY_PRINT) . PHP_EOL;
exit($out['ok'] ? 0 : 1);
