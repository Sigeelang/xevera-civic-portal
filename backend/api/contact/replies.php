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

require_once __DIR__ . '/../middleware/auth.php';
$user = requirePermission('messages', ['Staff', 'Admin', 'Super Admin']);

require_once __DIR__ . '/../config/database.php';

$messageId = (int)($_GET['id'] ?? 0);

if (!$messageId) {
    http_response_code(400);
    echo json_encode(['error' => 'Message ID is required.']);
    exit;
}

$stmt = $pdo->prepare("
    SELECT r.id, r.reply, r.created_at, u.name AS user_name
    FROM contact_message_replies r
    LEFT JOIN users u ON r.user_id = u.id
    WHERE r.message_id = ?
    ORDER BY r.created_at ASC
    LIMIT 200
");
$stmt->execute([$messageId]);
$rows = $stmt->fetchAll();

echo json_encode(array_map(function ($r) {
    return [
        'id' => (int)$r['id'],
        'reply' => $r['reply'],
        'user' => $r['user_name'] ?? 'Staff',
        'date' => (new DateTime($r['created_at'], new DateTimeZone('Asia/Manila')))->format('M j, Y g:i A'),
    ];
}, $rows));