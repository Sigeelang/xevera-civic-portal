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

$id = (int)($_GET['id'] ?? 0);
if (!$id) {
    http_response_code(400);
    echo json_encode(['error' => 'User ID is required.']);
    exit;
}

$stmt = $pdo->prepare('SELECT id, name, address, role, status FROM users WHERE id = ?');
$stmt->execute([$id]);
$user = $stmt->fetch();

if (!$user || $user['role'] !== 'Resident' || $user['status'] !== 'Active') {
    http_response_code(404);
    echo json_encode(['error' => 'Resident not found.']);
    exit;
}

$agg = $pdo->prepare("
    SELECT COUNT(*) AS submitted,
        COALESCE(SUM(status = 'Resolved'), 0) AS resolved,
        COALESCE(SUM(likes), 0) AS likes_received
    FROM reports WHERE reporter_user_id = ?
");
$agg->execute([$id]);
$stats = $agg->fetch();

$recentStmt = $pdo->prepare("
    SELECT ref_id, title, category, status, created_at
    FROM reports
    WHERE reporter_user_id = ? AND status = 'Resolved'
    ORDER BY created_at DESC
    LIMIT 5
");
$recentStmt->execute([$id]);
$recent = $recentStmt->fetchAll();

echo json_encode([
    'id' => (int)$user['id'],
    'name' => $user['name'],
    'verified' => true,
    'stats' => [
        'submitted' => (int)$stats['submitted'],
        'resolved' => (int)$stats['resolved'],
        'likes_received' => (int)$stats['likes_received'],
    ],
    'recent' => array_map(function ($r) {
        return [
            'id' => $r['ref_id'],
            'title' => $r['title'],
            'category' => $r['category'],
            'status' => $r['status'],
            'date' => date('M j, Y', strtotime($r['created_at'])),
        ];
    }, $recent),
]);