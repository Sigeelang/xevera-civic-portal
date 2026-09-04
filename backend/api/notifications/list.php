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
$user = requireAuth();

require_once __DIR__ . '/../config/database.php';

$userId = (int)$user['user_id'];
$limit = min(50, max(1, (int)($_GET['limit'] ?? 20)));

$stmt = $pdo->prepare('SELECT COUNT(*) FROM notifications WHERE user_id = ? AND is_read = 0');
$stmt->execute([$userId]);
$unread = (int)$stmt->fetchColumn();

$stmt = $pdo->prepare("
    SELECT n.id, n.report_id, n.announcement_id, n.type, n.message, n.is_read, n.created_at, r.ref_id, r.title AS report_title
    FROM notifications n
    LEFT JOIN reports r ON n.report_id = r.id
    WHERE n.user_id = ?
    ORDER BY n.created_at DESC
    LIMIT $limit
");
$stmt->execute([$userId]);
$items = $stmt->fetchAll();

echo json_encode([
    'items' => array_map(function ($n) {
        return [
            'id' => (int)$n['id'],
            'type' => $n['type'],
            'message' => $n['message'],
            'read' => (int)$n['is_read'] === 1,
            'date' => date('M j, Y g:i A', strtotime($n['created_at'])),
            'report_id' => $n['ref_id'] ?? null,
            'announcement_id' => $n['announcement_id'] ? (int)$n['announcement_id'] : null,
        ];
    }, $items),
    'total' => count($items),
    'unread' => $unread,
]);
