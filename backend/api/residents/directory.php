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
requireRole(['Staff', 'Admin', 'Super Admin']);

require_once __DIR__ . '/../config/database.php';

$q = trim($_GET['search'] ?? '');
$limit = min(60, max(1, (int)($_GET['limit'] ?? 24)));

$where = "u.role = 'Resident' AND u.status = 'Active'";
$params = [];
if ($q) {
    $where .= ' AND (u.name LIKE ? OR u.address LIKE ?)';
    $params[] = "%$q%";
    $params[] = "%$q%";
}

$stmt = $pdo->prepare("
    SELECT u.id, u.name, u.address,
        (SELECT COUNT(*) FROM reports r WHERE r.reporter_user_id = u.id) AS submitted,
        (SELECT COALESCE(SUM(r.status = 'Resolved'), 0) FROM reports r WHERE r.reporter_user_id = u.id) AS resolved,
        (SELECT COALESCE(SUM(r.likes), 0) FROM reports r WHERE r.reporter_user_id = u.id) AS likes_received
    FROM users u
    WHERE $where
    ORDER BY u.name ASC
    LIMIT $limit
");
$stmt->execute($params);
$users = $stmt->fetchAll();

echo json_encode([
    'items' => array_map(function ($u) {
        return [
            'id' => (int)$u['id'],
            'name' => $u['name'],
            'address' => $u['address'] ?? '',
            'submitted' => (int)$u['submitted'],
            'resolved' => (int)$u['resolved'],
            'likes_received' => (int)$u['likes_received'],
        ];
    }, $users),
]);
