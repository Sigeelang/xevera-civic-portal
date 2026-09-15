<?php
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
xevera_write_rate_limit($pdo, 'dm.delete');

require_once __DIR__ . '/../config/database.php';

$input = json_decode(file_get_contents('php://input'), true);
if (!is_array($input)) { $input = $_POST; }

$otherId = (int)($input['other_id'] ?? 0);
if (!$otherId) {
    http_response_code(400);
    echo json_encode(['error' => 'Conversation is required.']);
    exit;
}

$userId = (int)$user['user_id'];

/*
 * Delete the whole 1-on-1 conversation: every message where the
 * current user and the other user are the sender/recipient pair,
 * in either direction. Scoped to the requester's own conversations -
 * nobody can delete other people's threads.
 */
$stmt = $pdo->prepare('DELETE FROM direct_messages WHERE (sender_id = ? AND recipient_id = ?) OR (sender_id = ? AND recipient_id = ?)');
$stmt->execute([$userId, $otherId, $otherId, $userId]);

echo json_encode(['message' => 'Conversation deleted.', 'deleted' => $stmt->rowCount()]);
