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
$user = requireRole(['Staff', 'Admin', 'Super Admin']);

require_once __DIR__ . '/../config/database.php';

$input = json_decode(file_get_contents('php://input'), true);
$id = (int)($input['id'] ?? 0);

if (!$id) {
    http_response_code(400);
    echo json_encode(['error' => 'Message ID is required.']);
    exit;
}

/* unread: true re-opens the ticket (status back to "new") */
$markUnread = !empty($input['unread']);

$stmt = $pdo->prepare('UPDATE contact_messages SET status = ? WHERE id = ?');
$stmt->execute([$markUnread ? 'new' : 'read', $id]);

echo json_encode(['message' => $markUnread ? 'Message marked as unread.' : 'Message marked as read.']);