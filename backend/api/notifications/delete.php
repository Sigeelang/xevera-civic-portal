<?php
/**
 * Deletes ONE notification belonging to the authenticated user.
 * Users can only delete their own notifications.
 */
header('Content-Type: application/json');
require_once __DIR__ . '/../config/cors.php';

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

require_once __DIR__ . '/../middleware/auth.php';
require_once __DIR__ . '/../middleware/write_ratelimit.php';
$user = requireAuth();
xevera_write_rate_limit($pdo, 'notifications.delete');

require_once __DIR__ . '/../config/database.php';

$input = json_decode(file_get_contents('php://input'), true);
$id = (int)($input['id'] ?? 0);

if (!$id) {
    http_response_code(400);
    echo json_encode(['error' => 'Notification ID is required.']);
    exit;
}

$stmt = $pdo->prepare('DELETE FROM notifications WHERE id = ? AND user_id = ?');
$stmt->execute([$id, (int)$user['user_id']]);

if ($stmt->rowCount() === 0) {
    http_response_code(404);
    echo json_encode(['error' => 'Notification not found.']);
    exit;
}

echo json_encode(['success' => true, 'message' => 'Notification deleted.']);
