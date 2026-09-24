<?php
header('Content-Type: application/json');
require_once __DIR__ . '/../config/cors.php';

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }
if ($_SERVER['REQUEST_METHOD'] !== 'GET') { http_response_code(405); echo json_encode(['error' => 'Method not allowed']); exit; }

/*
 * Anonymous community feedback for one report (resident-safe).
 *
 * Unlike feedback/list.php (staff-only: exposes resident names),
 * this returns aggregates plus anonymized entries only:
 *   { count, average,
 *     items: [{ label: "Resident #000128", rating, comment, created_at }] }
 * Labels use the padded numeric id only — no names, emails, or anything
 * identifying. Capped at 20, newest first.
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

$agg = $pdo->prepare('SELECT COUNT(*) AS count, COALESCE(AVG(rating), 0) AS avg FROM feedback WHERE report_id = ?');
$agg->execute([$reportId]);
$stats = $agg->fetch();

$rows = $pdo->prepare('SELECT resident_id, rating, comment, created_at FROM feedback WHERE report_id = ? ORDER BY created_at DESC LIMIT 20');
$rows->execute([$reportId]);
$items = array_map(function ($r) {
    return [
        'label' => 'Resident #' . str_pad((int)$r['resident_id'], 6, '0', STR_PAD_LEFT),
        'rating' => (int)$r['rating'],
        'comment' => $r['comment'],
        'created_at' => $r['created_at'],
    ];
}, $rows->fetchAll());

echo json_encode([
    'count' => (int)$stats['count'],
    'average' => round((float)$stats['avg'], 1),
    'items' => $items,
]);
