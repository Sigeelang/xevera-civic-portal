<?php
/**
 * Idempotent migration: direct_messages.image_path (nullable).
 *
 * Stores an optional attached photo for a direct message
 * (backend-relative path, e.g. "uploads/dm_abc123.jpg").
 * NULL = text-only message.
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
       AND COLUMN_NAME = 'image_path'"
)->fetchColumn();

if ((int) $colExists === 0) {
    $pdo->exec("ALTER TABLE direct_messages ADD COLUMN image_path VARCHAR(255) NULL DEFAULT NULL AFTER message");
    echo "added direct_messages.image_path\n";
} else {
    echo "column already exists - skipped\n";
}

echo "migration complete\n";
