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

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../middleware/auth.php';

$user = requireAuth();
$userId = (int)$user['user_id'];

$limit = min(50, max(1, (int)($_GET['limit'] ?? 20)));
$status = $_GET['status'] ?? 'All';
$filter = $_GET['filter'] ?? 'mine';

$emailStmt = $pdo->prepare('SELECT email FROM users WHERE id = ?');
$emailStmt->execute([$userId]);
$email = trim($emailStmt->fetchColumn() ?: '');

if (!$email) {
    echo json_encode(['items' => [], 'total' => 0, 'email' => '']);
    exit;
}

if ($filter === 'followed') {
    $where = 'EXISTS (SELECT 1 FROM report_follows f WHERE f.report_id = r.id AND f.user_id = ?)';
    $params = [$userId];
} else {
    $where = '(r.reporter_user_id = ? OR (r.reporter_user_id IS NULL AND r.reporter_email = ?))';
    $params = [$userId, $email];
}
if ($status !== 'All') {
    if ($status === 'Admin Action') {
        $where .= ' AND r.status IN (?, ?, ?)';
        $params[] = 'Pending';
        $params[] = 'Verified';
        $params[] = 'Resolved';
    } else {
        $where .= ' AND r.status = ?';
        $params[] = $status;
    }
}

$countStmt = $pdo->prepare("SELECT COUNT(*) FROM reports r WHERE $where");
$countStmt->execute($params);
$total = (int)$countStmt->fetchColumn();

$stmt = $pdo->prepare("
    SELECT r.*, u.name AS assigned_name,
        CASE WHEN EXISTS(SELECT 1 FROM report_likes l WHERE l.report_id = r.id AND l.user_id = ?) THEN 1 ELSE 0 END AS liked,
        CASE WHEN EXISTS(SELECT 1 FROM report_follows f WHERE f.report_id = r.id AND f.user_id = ?) THEN 1 ELSE 0 END AS followed
    FROM reports r
    LEFT JOIN users u ON r.assigned_to = u.id
    WHERE $where
    ORDER BY r.created_at DESC
    LIMIT $limit
");
$stmt->execute(array_merge([$userId, $userId], $params));
$reports = $stmt->fetchAll();

$items = array_map(function ($r) {
    return [
        'id' => $r['ref_id'],
        'title' => $r['title'],
        'category' => $r['category'],
        'priority' => $r['priority'] ?? 'Normal',
        'location' => $r['location'],
        'latitude' => isset($r['latitude']) ? (float)$r['latitude'] : null,
        'longitude' => isset($r['longitude']) ? (float)$r['longitude'] : null,
        'date' => date('M j, Y', strtotime($r['created_at'])),
        'status' => $r['status'],
        'report_verified' => !empty($r['verified_at']),
        'assigned' => $r['assigned_name'] ?? '-',
        'likes' => (int)$r['likes'],
        'comments' => (int)$r['comments_count'],
        'desc' => $r['description'],
        'reporter' => $r['reporter_name'] ?? 'Anonymous',
        'photos' => json_decode($r['photo_paths'] ?? '[]', true),
        'verified' => (int)$r['reporter_user_id'] > 0,
        'liked' => (int)($r['liked'] ?? 0) === 1,
        'followed' => (int)($r['followed'] ?? 0) === 1,
    ];
}, $reports);

echo json_encode([
    'items' => $items,
    'total' => $total,
    'email' => $email,
]);
