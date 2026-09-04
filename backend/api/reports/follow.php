<?php
header('Content-Type: application/json');
require_once __DIR__ . '/../config/cors.php';

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

require_once __DIR__ . '/../middleware/auth.php';
require_once __DIR__ . '/../middleware/write_ratelimit.php';
$user = requireRole(['Resident']);
xevera_write_rate_limit($pdo, 'reports.follow');

require_once __DIR__ . '/../config/database.php';

$input = json_decode(file_get_contents('php://input'), true);
$refId = trim($input['id'] ?? '');

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

$reportId = (int)$report['id'];
$userId = (int)$user['user_id'];

$stmt = $pdo->prepare('SELECT id FROM report_follows WHERE report_id = ? AND user_id = ?');
$stmt->execute([$reportId, $userId]);
$existing = $stmt->fetch();

if ($existing) {
    $stmt = $pdo->prepare('DELETE FROM report_follows WHERE report_id = ? AND user_id = ?');
    $stmt->execute([$reportId, $userId]);
    $followed = false;
} else {
    $stmt = $pdo->prepare('INSERT INTO report_follows (report_id, user_id) VALUES (?, ?)');
    $stmt->execute([$reportId, $userId]);
    $followed = true;
}

echo json_encode(['followed' => $followed]);
