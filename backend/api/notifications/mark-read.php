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
require_once __DIR__ . '/../middleware/write_ratelimit.php';
$user = requireAuth();
xevera_write_rate_limit($pdo, 'notifications.mark_read');

require_once __DIR__ . '/../config/database.php';

$userId = (int)$user['user_id'];
$input = json_decode(file_get_contents('php://input'), true);
$id = $input['id'] ?? null;

if ($id !== null && $id !== 'all') {
    $stmt = $pdo->prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ? AND id = ?');
    $stmt->execute([$userId, (int)$id]);
} else {
    $stmt = $pdo->prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0');
    $stmt->execute([$userId]);
}

echo json_encode(['message' => 'Notifications marked as read.']);
