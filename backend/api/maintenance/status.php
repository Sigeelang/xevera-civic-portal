<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

require_once __DIR__ . '/../config/database.php';

$settings = [];
foreach ($pdo->query('SELECT `key`, `value` FROM system_settings')->fetchAll() as $row) {
    $settings[$row['key']] = $row['value'];
}

$mode = (int)($settings['maintenance_mode'] ?? 0) === 1;
$enabledBy = $settings['maintenance_enabled_by'] ?? 'manual';
$scheduledAt = $settings['maintenance_scheduled_at'] ?? null;
$return = $settings['maintenance_return'] ?? null;

// Real event windows
$eventRows = [];
$events = $pdo->query('SELECT * FROM maintenance_events ORDER BY start_at DESC LIMIT 5');
$onlyEvents = [];
if ($events) {
    foreach ($events->fetchAll() as $e) {
        $start = strtotime($e['start_at'] ?: 'now');
        $end = strtotime($e['end_at'] ?: ($e['start_at'] ?: 'now'));

        $progress = null;
        $eta = null;
        if ($end > time() && $start <= time()) {
            $total = max(1, $end - $start);
            $progress = (int)round((time() - $start) / $total * 100);
            $remaining = max(0, $end - time());
            $eta = $remaining > 3600
                ? round($remaining / 3600, 1) . ' hours remaining'
                : max(1, (int)round($remaining / 60)) . ' minutes remaining';
        } elseif ($end <= time()) {
            $progress = 100;
            $eta = 'Complete';
        }

        $eventRows[] = [
            'id' => (int)$e['id'],
            'type' => $e['type'],
            'reason' => $e['reason'] ?? '',
            'status' => $e['status'],
            'progress' => $progress,
            'eta' => $eta,
            'starts_at' => $e['start_at'],
            'ends_at' => $e['end_at'],
        ];
    }
}

// Active window progress
$progress = 0;
$eta = null;
$active = null;
if ($mode && $scheduledAt && $return) {
    $start = strtotime($scheduledAt);
    $end = strtotime($return);
    if ($end > time()) {
        $active = ['start' => $scheduledAt, 'end' => $return];
        $progress = $end > $start ? min(100, max(0, round((time() - $start) / ($end - $start) * 100))) : 0;
        $eta = ceil(($end - time()) / 60) . ' minutes remaining';
    }
}

echo json_encode([
    'maintenance_mode' => $mode,
    'enabled_by' => $enabledBy,
    'progress' => $progress,
    'eta' => $eta,
    'scheduled_at' => $scheduledAt,
    'return_at' => $return,
    'active_window' => $active,
    'events' => $eventRows,
    'updated_at' => date('Y-m-d H:i:s'),
]);