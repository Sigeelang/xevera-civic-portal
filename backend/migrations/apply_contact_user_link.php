<?php
/**
 * Idempotent migration: contact_messages.user_id (nullable).
 *
 * Links a Contact Support submission to the submitting resident's
 * account so staff replies can be mirrored into the resident's
 * Message Box. Anonymous submissions keep user_id = NULL.
 *
 * CLI-only. Safe to re-run (checks information_schema first).
 */
if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit('Not found');
}

require_once __DIR__ . '/../api/config/env.php';

$pdo = new PDO(
    sprintf('mysql:host=%s;port=%s;dbname=%s;charset=utf8mb4',
        getenv('DB_HOST') ?: 'localhost',
        getenv('DB_PORT') ?: '3306',
        getenv('DB_NAME') ?: 'xevera_civic'),
    getenv('DB_USER') ?: 'root',
    (string) getenv('DB_PASS'),
    [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]
);

$colExists = $pdo->query(
    "SELECT COUNT(*) FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'contact_messages'
       AND COLUMN_NAME = 'user_id'"
)->fetchColumn();

if ((int) $colExists === 0) {
    $pdo->exec('ALTER TABLE contact_messages ADD COLUMN user_id INT NULL DEFAULT NULL, ADD INDEX idx_user (user_id)');
    echo "added contact_messages.user_id\n";
} else {
    echo "column already exists - skipped\n";
}

echo "migration complete\n";
