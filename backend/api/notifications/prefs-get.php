<?php
header('Content-Type: application/json');
require_once __DIR__ . '/../config/cors.php';

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../middleware/auth.php';

$user = requireRole(['Resident']);
$userId = (int)$user['user_id'];

$stmt = $pdo->prepare('SELECT * FROM notification_prefs WHERE user_id = ?');
$stmt->execute([$userId]);
$row = $stmt->fetch();

if (!$row) {
    echo json_encode([
        'notify_like' => 1,
        'notify_comment' => 1,
        'notify_status' => 1,
        'notify_follow' => 1,
    ]);
    exit;
}

echo json_encode([
    'notify_like' => (int)$row['notify_like'] === 1,
    'notify_comment' => (int)$row['notify_comment'] === 1,
    'notify_status' => (int)$row['notify_status'] === 1,
    'notify_follow' => (int)$row['notify_follow'] === 1,
]);