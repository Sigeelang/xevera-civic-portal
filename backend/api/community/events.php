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

$limit = min(10, max(1, (int)($_GET['limit'] ?? 5)));
$stmt = $pdo->prepare("
    SELECT id, title, description, location, category, DATE_FORMAT(starts_at, '%Y-%m-%dT%H:%i:%s') AS starts_at
    FROM community_events
    ORDER BY starts_at ASC
    LIMIT ?
");
$stmt->execute([$limit]);
$events = $stmt->fetchAll();

$items = array_map(function ($e) {
    $ts = $e['starts_at'] ? strtotime($e['starts_at']) : null;
    return [
        'id' => (int)$e['id'],
        'title' => $e['title'],
        'description' => $e['description'] ?? '',
        'location' => $e['location'] ?? '',
        'category' => $e['category'] ?? 'General',
        'date' => $ts ? date('M j, Y', $ts) : '',
        'time' => $ts ? date('g:i A', $ts) : '',
        'starts_at' => $e['starts_at'],
    ];
}, $events);

echo json_encode(['items' => $items]);
