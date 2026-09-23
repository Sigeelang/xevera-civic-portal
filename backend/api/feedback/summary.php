<?php
header('Content-Type: application/json');
require_once __DIR__ . '/../config/cors.php';

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }
if ($_SERVER['REQUEST_METHOD'] !== 'GET') { http_response_code(405); echo json_encode(['error' => 'Method not allowed']); exit; }

/*
 * Resident-safe feedback summary for one report.
 *
 * Unlike feedback/list.php (staff-only: it exposes resident names),
 * this returns only aggregates plus the caller's own rating:
 *   { count, average, mine: {rating, comment, created_at} | null }
 */
require_once __DIR__ . '/../middleware/auth.php';
$user = requireRole(['Resident']);

require_once __DIR__ . '/../config/database.php';

$refId = trim($_GET['ref_id'] ?? '');
if ($refId === '') {
    http_response_code(400);
    echo json_encode(['error' => 'Report reference is required.']);
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

$agg = $pdo->prepare('SELECT COUNT(*) AS count, COALESCE(AVG(rating), 0) AS avg FROM feedback WHERE report_id = ?');
$agg->execute([$reportId]);
$stats = $agg->fetch();

$mineStmt = $pdo->prepare('SELECT rating, comment, created_at FROM feedback WHERE report_id = ? AND resident_id = ? ORDER BY created_at DESC LIMIT 1');
$mineStmt->execute([$reportId, $userId]);
$mine = $mineStmt->fetch();

echo json_encode([
    'count' => (int)$stats['count'],
    'average' => round((float)$stats['avg'], 1),
    'mine' => $mine ? [
        'rating' => (int)$mine['rating'],
        'comment' => $mine['comment'],
        'created_at' => $mine['created_at'],
    ] : null,
]);
