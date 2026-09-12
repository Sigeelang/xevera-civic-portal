<?php
require_once '/var/www/xevera/backend/api/config/database.php';
try {
    $pdo->exec("ALTER TABLE direct_messages ADD COLUMN read_at DATETIME DEFAULT NULL AFTER is_read");
    echo "read_at column added successfully.\n";
} catch (PDOException $e) {
    if (strpos($e->getMessage(), 'Duplicate column') !== false) {
        echo "read_at column already exists.\n";
    } else {
        echo "Error: " . $e->getMessage() . "\n";
    }
}
