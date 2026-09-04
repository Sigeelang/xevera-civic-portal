<?php
require_once __DIR__ . '/env.php';

$host = getenv('DB_HOST') ?: 'localhost';
$dbname = getenv('DB_NAME') ?: 'xevera_civic';
$username = getenv('DB_USER') ?: 'root';
$password = (string) getenv('DB_PASS');
$port = getenv('DB_PORT') ?: '3306';

try {
    $pdo = new PDO(
        "mysql:host=$host;port=$port;dbname=$dbname;charset=utf8mb4",
        $username,
        $password,
        [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
        ]
    );
    // Force Manila PH timezone for all sessions (UTC+8) so NOW() / created_at are consistent
    try { $pdo->exec("SET time_zone = '+08:00'"); } catch (PDOException $e) { /* ignore if privilege missing */ }
} catch (PDOException $e) {
    error_log('xevera_db: connection failed: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['error' => 'Database connection failed.']);
    exit;
}
