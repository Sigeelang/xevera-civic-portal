<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

require_once __DIR__ . '/../middleware/auth.php';
$me = requirePermission('backup', ['Super Admin']);

require_once __DIR__ . '/../config/backup.php';

$input = json_decode(file_get_contents('php://input'), true);
$name = trim($input['name'] ?? '');
if ($name === '' || strpos($name, '..') !== false || !preg_match('/^[A-Za-z0-9._-]+$/', $name)) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid backup file.']);
    exit;
}

$file = xevera_backup_dir() . DIRECTORY_SEPARATOR . $name . '.sql';
if (!is_file($file)) {
    http_response_code(404);
    echo json_encode(['error' => 'Backup not found.']);
    exit;
}

$db_host = getenv('DB_HOST') ?: 'localhost';
$db_port = getenv('DB_PORT') ?: '3306';
$db_user = getenv('DB_USER') ?: 'root';
$db_pass = getenv('DB_PASS') ?: '';
$db_name = getenv('DB_NAME') ?: 'xevera_civic';

$mysql = 'mysql';
$candidate = 'C:\\xampp\\mysql\\bin\\mysql.exe';
if (is_file($candidate)) {
    $mysql = $candidate;
}

$cmd = sprintf(
    '%s --host=%s --port=%s --user=%s',
    escapeshellarg($mysql),
    escapeshellarg($db_host),
    escapeshellarg($db_port),
    escapeshellarg($db_user)
);
if ($db_pass !== '') $cmd .= ' --password=' . escapeshellarg($db_pass);
$cmd .= ' ' . escapeshellarg($db_name) . ' < ' . escapeshellarg($file) . ' 2>&1';

exec($cmd, $output, $exitCode);

if ($exitCode === 0) {
    $stmt = $pdo->prepare('INSERT INTO activity_logs (user_id, action, target_type, target_id, detail) VALUES (?, ?, ?, NULL, ?)');
    $stmt->execute([(int)$me['user_id'], 'restore_backup', 'backup', 'Restored database from: ' . $name . '.sql']);

    echo json_encode(['success' => true, 'message' => 'Database restored successfully from ' . $name . '.sql']);
} else {
    http_response_code(500);
    echo json_encode(['error' => 'Restore failed.', 'detail' => implode("\n", array_slice($output, 0, 8))]);
}