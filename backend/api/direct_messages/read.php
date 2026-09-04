<?php
header('Content-Type: application/json');
require_once __DIR__ . '/../config/cors.php';

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }
if ($_SERVER['REQUEST_METHOD'] !== 'POST') { http_response_code(405); echo json_encode(['error' => 'Method not allowed']); exit; }

require_once __DIR__ . '/../middleware/auth.php';
$user = requireRole(['Staff', 'Admin', 'Super Admin', 'Resident']);

require_once __DIR__ . '/../config/database.php';

$userId = (int)$user['user_id'];
$input = json_decode(file_get_contents('php://input'), true);
$id = $input['id'] ?? null;

/*
 * Optional unread mode: restore messages to unread.
 * - { unread: true, id: <msgId> }      -> single message
 * - { unread: true, other_id: <uid> }  -> whole conversation from one sender
 */
$unread = !empty($input['unread']);

if ($unread) {
    $otherId = (int)($input['other_id'] ?? 0);
    if ($otherId > 0) {
        $stmt = $pdo->prepare('UPDATE direct_messages SET is_read = 0 WHERE recipient_id = ? AND sender_id = ?');
        $stmt->execute([$userId, $otherId]);
    } elseif ($id !== null && $id !== 'all') {
        $stmt = $pdo->prepare('UPDATE direct_messages SET is_read = 0 WHERE recipient_id = ? AND id = ?');
        $stmt->execute([$userId, (int)$id]);
    }

    echo json_encode(['message' => 'Messages marked as unread.']);
    exit;
}

if ($id !== null && $id !== 'all') {
    $stmt = $pdo->prepare('UPDATE direct_messages SET is_read = 1 WHERE recipient_id = ? AND id = ?');
    $stmt->execute([$userId, (int)$id]);
} else {
    $stmt = $pdo->prepare('UPDATE direct_messages SET is_read = 1 WHERE recipient_id = ? AND is_read = 0');
    $stmt->execute([$userId]);
}

echo json_encode(['message' => 'Messages marked as read.']);
