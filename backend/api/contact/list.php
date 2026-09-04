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
$user = requireRole(['Staff', 'Admin', 'Super Admin']);

require_once __DIR__ . '/../config/database.php';

$status = $_GET['status'] ?? 'all';
$workflowStatus = $_GET['workflow_status'] ?? '';
$limit = min(100, max(1, (int)($_GET['limit'] ?? 50)));

$where = '';
$params = [];
if ($workflowStatus && in_array($workflowStatus, ['New', 'In Review', 'In Progress', 'Resolved', 'Closed'], true)) {
    $where = ' WHERE workflow_status = ?';
    $params[] = $workflowStatus;
} elseif ($status === 'new' || $status === 'read') {
    $where = ' WHERE status = ?';
    $params[] = $status;
}

$stmt = $pdo->prepare("SELECT COUNT(*) FROM contact_messages WHERE status = 'new'");
$stmt->execute();
$unread = (int)$stmt->fetchColumn();

$stmt = $pdo->prepare("
    SELECT m.id, m.name, m.email, m.phone, m.category, m.subject, m.message, m.status, m.workflow_status, m.created_at,
        (SELECT COUNT(*) FROM contact_message_replies r WHERE r.message_id = m.id) AS reply_count
    FROM contact_messages m$where
    ORDER BY m.created_at DESC LIMIT $limit
");
$stmt->execute($params);
$rows = $stmt->fetchAll();

echo json_encode([
    'items' => array_map(function ($m) {
        return [
            'id' => (int)$m['id'],
            'name' => $m['name'],
            'email' => $m['email'],
            'phone' => $m['phone'] ?? '',
            'category' => $m['category'] ?? '',
            'subject' => $m['subject'],
            'message' => $m['message'],
            'status' => $m['status'],
            'workflow_status' => $m['workflow_status'] ?? 'New',
            'reply_count' => (int)($m['reply_count'] ?? 0),
            'date' => (new DateTime($m['created_at'], new DateTimeZone('Asia/Manila')))->format('M j, Y g:i A'),
        ];
    }, $rows),
    'unread' => $unread,
    'total' => count($rows),
]);