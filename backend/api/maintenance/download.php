<?php
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

require_once __DIR__ . '/../middleware/auth.php';
requireRole(['Admin', 'Super Admin']);

require_once __DIR__ . '/../config/backup.php';

$name = $_GET['name'] ?? '';
if ($name === '' || strpos($name, '..') !== false || !preg_match('/^backup_\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}\.sql$/', $name)) {
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

header('Content-Type: application/sql');
header('Content-Disposition: attachment; filename="' . $name . '"');
header('Content-Length: ' . (string)filesize($file));
readfile($file);