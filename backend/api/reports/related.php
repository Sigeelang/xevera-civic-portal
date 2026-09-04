<?php
header('Content-Type: application/json');
require_once __DIR__ . '/../config/cors.php';

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }
if ($_SERVER['REQUEST_METHOD'] !== 'GET') { http_response_code(405); echo json_encode(['error' => 'Method not allowed']); exit; }

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../middleware/token.php';

$payload = token_payload();
$refId = trim($_GET['id'] ?? '');
$limit = min(20, max(1, (int)($_GET['limit'] ?? 10)));

if (!$refId) {
    http_response_code(400);
    echo json_encode(['error' => 'Report ID is required.']);
    exit;
}

$stmt = $pdo->prepare('SELECT id, ref_id, title, category, location, status, created_at, photo_paths FROM reports WHERE ref_id = ?');
$stmt->execute([$refId]);
$current = $stmt->fetch();

if (!$current) {
    http_response_code(404);
    echo json_encode(['error' => 'Report not found.']);
    exit;
}

$currentId = (int)$current['id'];
$currentCategory = $current['category'];
$currentLocation = $current['location'];

$related = [];

// Same category + same location
$stmt = $pdo->prepare("
    SELECT r.*, u.name AS assigned_name, 3 AS relevance
    FROM reports r
    LEFT JOIN users u ON r.assigned_to = u.id
    WHERE r.id != ? AND r.category = ? AND r.location = ?
    ORDER BY r.created_at DESC
    LIMIT ?
");
$stmt->execute([$currentId, $currentCategory, $currentLocation, $limit]);
$related = $stmt->fetchAll();

// Fallback: same category
if (count($related) < $limit) {
    $remaining = $limit - count($related);
    $existingIds = array_column($related, 'id');
    $existingIds[] = $currentId;
    $placeholders = implode(',', array_fill(0, count($existingIds), '?'));

    $stmt = $pdo->prepare("
        SELECT r.*, u.name AS assigned_name, 2 AS relevance
        FROM reports r
        LEFT JOIN users u ON r.assigned_to = u.id
        WHERE r.id NOT IN ($placeholders) AND r.category = ?
        ORDER BY r.created_at DESC
        LIMIT ?
    ");
    $stmt->execute(array_merge($existingIds, [$currentCategory, $remaining]));
    $related = array_merge($related, $stmt->fetchAll());
}

// Fallback: same location
if (count($related) < $limit) {
    $remaining = $limit - count($related);
    $existingIds = array_column($related, 'id');
    $existingIds[] = $currentId;
    $placeholders = implode(',', array_fill(0, count($existingIds), '?'));

    $stmt = $pdo->prepare("
        SELECT r.*, u.name AS assigned_name, 1 AS relevance
        FROM reports r
        LEFT JOIN users u ON r.assigned_to = u.id
        WHERE r.id NOT IN ($placeholders) AND r.location = ?
        ORDER BY r.created_at DESC
        LIMIT ?
    ");
    $stmt->execute(array_merge($existingIds, [$currentLocation, $remaining]));
    $related = array_merge($related, $stmt->fetchAll());
}

// Deduplicate
$seen = [];
$unique = [];
foreach ($related as $r) {
    if (!isset($seen[$r['id']])) {
        $seen[$r['id']] = true;
        $unique[] = $r;
    }
}
$related = array_slice($unique, 0, $limit);

$items = array_map(function ($r) {
    return [
        'id' => $r['ref_id'],
        'title' => $r['title'],
        'category' => $r['category'],
        'location' => $r['location'],
        'date' => date('M j, Y', strtotime($r['created_at'])),
        'status' => $r['status'],
        'priority' => $r['priority'] ?? 'Normal',
        'assigned' => $r['assigned_name'] ?? '-',
        'photos' => json_decode($r['photo_paths'] ?? '[]', true),
        'relevance' => (int)($r['relevance'] ?? 0),
    ];
}, $related);

echo json_encode(['items' => $items, 'total' => count($items)]);
