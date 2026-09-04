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

$refId = trim($_GET['id'] ?? '');

if (!$refId) {
    http_response_code(400);
    echo json_encode(['error' => 'Report ID is required.']);
    exit;
}

$stmt = $pdo->prepare('SELECT id FROM reports WHERE ref_id = ?');
$stmt->execute([$refId]);
$report = $stmt->fetch();

if (!$report) {
    http_response_code(404);
    echo json_encode(['error' => 'Report not found.']);
    exit;
}

$stmt = $pdo->prepare("
    SELECT c.id, c.comment, c.created_at, c.user_id, u.name AS user_name
    FROM report_comments c
    LEFT JOIN users u ON c.user_id = u.id
    WHERE c.report_id = ?
    ORDER BY c.created_at DESC
    LIMIT 50
");
$stmt->execute([(int)$report['id']]);
$items = $stmt->fetchAll();

echo json_encode(array_map(function ($c) {
    return [
        'id' => (int)$c['id'],
        'comment' => $c['comment'],
        'user' => !empty($c['user_id']) ? 'XR-RES-' . str_pad((int)$c['user_id'], 6, '0', STR_PAD_LEFT) : 'Resident',
        'date' => date('M j, Y g:i A', strtotime($c['created_at'])),
    ];
}, $items));
