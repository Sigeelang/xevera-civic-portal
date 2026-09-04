<?php
/**
 * Idempotent migration: direct_messages.contact_message_id (nullable).
 *
 * Tags direct messages that belong to a specific Contact Support
 * submission so each submission = ONE separate conversation thread.
 * NULL = regular user-to-user direct message.
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
       AND TABLE_NAME = 'direct_messages'
       AND COLUMN_NAME = 'contact_message_id'"
)->fetchColumn();

if ((int) $colExists === 0) {
    $pdo->exec('ALTER TABLE direct_messages ADD COLUMN contact_message_id INT NULL DEFAULT NULL, ADD INDEX idx_contact_thread (contact_message_id)');
    echo "added direct_messages.contact_message_id\n";
} else {
    echo "column already exists - skipped\n";
}

echo "migration complete\n";
