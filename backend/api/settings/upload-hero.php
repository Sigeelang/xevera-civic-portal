<?php
header('Content-Type: application/json');
require_once __DIR__ . '/../config/cors.php';

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

require_once __DIR__ . '/../middleware/auth.php';
require_once __DIR__ . '/../middleware/upload.php';
requireRole(['Super Admin']);

if (empty($_FILES['hero']) || $_FILES['hero']['error'] !== UPLOAD_ERR_OK) {
    http_response_code(400);
    echo json_encode(['error' => 'No image uploaded.']);
    exit;
}

$validated = xevera_validate_image_upload($_FILES['hero'], 8 * 1024 * 1024);
$ext = $validated['ext'];

$uploadDir = __DIR__ . '/../../uploads/';
if (!is_dir($uploadDir)) {
    mkdir($uploadDir, 0755, true);
}

$target = $uploadDir . 'hero_banner.' . $ext;
if (!move_uploaded_file($_FILES['hero']['tmp_name'], $target)) {
    http_response_code(500);
    echo json_encode(['error' => 'Failed to save image.']);
    exit;
}

require_once __DIR__ . '/../config/database.php';

$path = 'uploads/hero_banner.' . $ext . '?v=' . time();
$stmt = $pdo->prepare('INSERT INTO system_settings (`key`, `value`) VALUES (\'hero_banner\', ?) ON DUPLICATE KEY UPDATE `value` = VALUES(`value`)');
$stmt->execute([$path]);

echo json_encode(['message' => 'Hero banner updated.', 'hero_banner' => $path]);
