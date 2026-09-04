<?php
header('Content-Type: application/json');
require_once __DIR__ . '/../config/cors.php';

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

require_once __DIR__ . '/../config/database.php';

function decorateEvent($e) {
    $durationMin = $e['start_at'] && $e['end_at'] ? (int)round((strtotime($e['end_at']) - strtotime($e['start_at'])) / 60) : 0;
    $e['duration_min'] = $durationMin > 0 ? $durationMin : null;
    $e['duration_display'] = $e['duration_min'] !== null
        ? (floor($e['duration_min'] / 60) > 0 ? floor($e['duration_min'] / 60) . 'h ' . ($e['duration_min'] % 60) . 'm' : $e['duration_min'] . 'm')
        : (($e['end_at'] && $e['start_at']) ? '—' : '');
    unset($e['created_by'], $e['updated_at']);
    return $e;
}

$stmt = $pdo->prepare(
    "SELECT * FROM maintenance_events
     WHERE type = 'scheduled'
       AND status IN ('scheduled', 'running')
       AND start_at IS NOT NULL
       AND end_at IS NOT NULL
       AND end_at >= NOW()
     ORDER BY start_at ASC"
);
$stmt->execute();
$windows = array_map('decorateEvent', $stmt->fetchAll());

$completedStmt = $pdo->prepare(
    "SELECT * FROM maintenance_events
     WHERE status = 'completed'
       AND start_at IS NOT NULL
     ORDER BY start_at DESC
     LIMIT 10"
);
$completedStmt->execute();
$completed = array_map('decorateEvent', $completedStmt->fetchAll());

echo json_encode([
    'items' => array_values($windows),
    'completed' => array_values($completed),
]);