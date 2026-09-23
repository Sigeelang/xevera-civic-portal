<?php
/*
 * One-shot migration: per-user conversation preferences.
 *
 * Powers the Message Box row menu (archive / mute). Keys match the
 * frontend conversation ids: dm-<other_user_id> for 1-on-1 threads,
 * ct-<contact_message_id> for contact-support threads.
 * Safe to run multiple times.
 *
 * CLI ONLY: php apply_conversation_prefs.php
 */

if (php_sapi_name() !== 'cli') {
    http_response_code(403);
    echo json_encode(['error' => 'CLI only.']);
    exit;
}

require_once __DIR__ . '/../api/config/database.php';

$out = ['ok' => true, 'steps' => []];

try {
    $pdo->exec("CREATE TABLE IF NOT EXISTS conversation_prefs (
        user_id INT NOT NULL,
        conversation_key VARCHAR(64) NOT NULL,
        archived TINYINT(1) NOT NULL DEFAULT 0,
        muted TINYINT(1) NOT NULL DEFAULT 0,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (user_id, conversation_key),
        KEY idx_cp_user (user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    $out['steps']['conversation_prefs'] = 'ready';
} catch (Throwable $e) {
    $out['ok'] = false;
    $out['steps']['conversation_prefs'] = 'ERROR: ' . $e->getMessage();
}

echo json_encode($out, JSON_PRETTY_PRINT) . PHP_EOL;
exit($out['ok'] ? 0 : 1);
