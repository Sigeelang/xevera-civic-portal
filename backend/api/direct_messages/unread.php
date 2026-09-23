<?php
/*
 * Mark a whole conversation as unread (inverse of read.php).
 * POST {other_id} for 1-on-1 threads or {contact_message_id} for
 * support threads. Only the caller's own received messages flip.
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
$user = requireAuth();

require_once __DIR__ . '/../config/database.php';

$input = json_decode(file_get_contents('php://input'), true);
if (!is_array($input)) { $input = $_POST; }

$userId = (int)$user['user_id'];
$otherId = (int)($input['other_id'] ?? 0);
$contactId = (int)($input['contact_message_id'] ?? 0);

if ($contactId) {
    $stmt = $pdo->prepare('UPDATE direct_messages SET is_read = 0 WHERE contact_message_id = ? AND recipient_id = ?');
    $stmt->execute([$contactId, $userId]);
} elseif ($otherId) {
    $stmt = $pdo->prepare('UPDATE direct_messages SET is_read = 0 WHERE ((sender_id = ? AND recipient_id = ?) OR (sender_id = ? AND recipient_id = ?)) AND recipient_id = ?');
    $stmt->execute([$userId, $otherId, $otherId, $userId, $userId]);
} else {
    http_response_code(400);
    echo json_encode(['error' => 'Conversation is required.']);
    exit;
}

echo json_encode(['message' => 'Conversation marked as unread.', 'updated' => $stmt->rowCount()]);
