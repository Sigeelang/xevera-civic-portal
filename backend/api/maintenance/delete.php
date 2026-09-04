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
require_once __DIR__ . '/../middleware/write_ratelimit.php';
$me = requireRole(['Super Admin']);
xevera_write_rate_limit($pdo, 'maintenance.delete');

require_once __DIR__ . '/../config/backup.php';

$input = json_decode(file_get_contents('php://input'), true) ?: [];
$name = trim($input['name'] ?? '');
if ($name === '' || strpos($name, '..') !== false || !preg_match('/^[A-Za-z0-9._-]+\.sql$/', $name)) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid backup file.']);
    exit;
}

$file = xevera_backup_dir() . DIRECTORY_SEPARATOR . $name;
if (!is_file($file)) {
    http_response_code(404);
    echo json_encode(['error' => 'Backup not found.']);
    exit;
}

if (!@unlink($file)) {
    http_response_code(500);
    echo json_encode(['error' => 'Unable to delete backup.']);
    exit;
}

echo json_encode(['success' => true, 'message' => 'Backup deleted successfully.']);