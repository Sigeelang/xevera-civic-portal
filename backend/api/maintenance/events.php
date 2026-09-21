<?php
header('Content-Type: application/json');
require_once __DIR__ . '/../config/cors.php';

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }

require_once __DIR__ . '/../middleware/auth.php';
$currentUser = requirePermission('maintenance', ['Admin', 'Super Admin']);

require_once __DIR__ . '/../config/database.php';

function logEvent($pdo, $userId, $action, $detail) {
    $st = $pdo->prepare('INSERT INTO activity_logs (user_id, action, target_type, target_id, detail) VALUES (?, ?, ?, NULL, ?)');
    $st->execute([$userId, $action, 'maintenance', $detail]);
}

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $stmt = $pdo->query('SELECT * FROM maintenance_events ORDER BY created_at DESC');
    $items = $stmt->fetchAll();

    foreach ($items as &$e) {
        if ($e['start_at'] && $e['end_at']) {
            $e['duration_min'] = (int)round((strtotime($e['end_at']) - strtotime($e['start_at'])) / 60);
        } else {
            $e['duration_min'] = null;
        }
        $e['duration_display'] = $e['duration_min'] !== null && $e['duration_min'] > 0
            ? (floor($e['duration_min'] / 60) > 0 ? floor($e['duration_min'] / 60) . 'h ' . ($e['duration_min'] % 60) . 'm' : $e['duration_min'] . 'm')
            : '—';
    }
    unset($e);

    echo json_encode(['items' => $items, 'total' => count($items)]);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed.']);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true);

$action = $input['action'] ?? null;

if ($action === 'create') {
    $startAt = $input['start_at'] ?? null;
    $endAt = $input['end_at'] ?? null;
    $reason = trim((string)($input['reason'] ?? ''));

    if (!$startAt || !$endAt || strtotime($startAt) === false || strtotime($endAt) === false ) {
        http_response_code(400);
        echo json_encode(['error' => 'start_at and end_at are required and must be valid.']);
        exit;
    }
    if (strtotime($endAt) <= strtotime($startAt)) {
        http_response_code(400);
        echo json_encode(['error' => 'End time must be after start time.']);
        exit;
    }

    $doStart = strtotime($startAt) <= time();
    $status = $doStart ? 'running' : 'scheduled';

    $stmt = $pdo->prepare('INSERT INTO maintenance_events (type, reason, start_at, end_at, status, created_by) VALUES (?, ?, ?, ?, ?, ?)');
    $stmt->execute(['scheduled', $reason, date('Y-m-d H:i:s', strtotime($startAt)), date('Y-m-d H:i:s', strtotime($endAt)), $status, $currentUser['user_id']]);
    $eventId = $pdo->lastInsertId();

    logEvent($pdo, $currentUser['user_id'], 'schedule_maintenance', ($reason ?: 'Scheduled maintenance') . ' (' . $startAt . ' → ' . $endAt . ')');

    // Auto-create a public announcement for the scheduled maintenance
    $annTitle = 'Scheduled Maintenance: ' . ($reason ?: 'System Maintenance');
    $startFmt = date('M j, Y \a\t g:i A', strtotime($startAt));
    $endFmt = date('M j, Y \a\t g:i A', strtotime($endAt));
    $annContent = "A scheduled maintenance window has been set.\n\n"
        . "Reason: " . ($reason ?: 'System Maintenance') . "\n"
        . "Start: " . $startFmt . "\n"
        . "End: " . $endFmt . "\n\n"
        . "The portal may be temporarily unavailable during this period. We apologize for any inconvenience.";

    try {
        $annStmt = $pdo->prepare('INSERT INTO announcements (title, content, category, status, created_by, priority, audience, visibility, publish_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())');
        $annStmt->execute([$annTitle, $annContent, 'maintenance', 'Published', $currentUser['user_id'], 'Normal', 'All', 'Public']);
    } catch (PDOException $e) {
        error_log('xevera_maintenance: failed to create announcement: ' . $e->getMessage());
    }

    echo json_encode(['message' => 'Maintenance scheduled.', 'id' => $eventId]);
    exit;
}

if ($action === 'cancel') {
    $id = (int)($input['id'] ?? 0);
    if ($id <= 0) {
        http_response_code(400);
        echo json_encode(['error' => 'id is required.']);
        exit;
    }
    $stmt = $pdo->prepare('UPDATE maintenance_events SET status = ? WHERE id = ?');
    $stmt->execute(['cancelled', $id]);
    logEvent($pdo, $currentUser['user_id'], 'cancel_maintenance', 'Cancelled maintenance event #' . $id);
    echo json_encode(['message' => 'Maintenance cancelled.']);
    exit;
}

if ($action === 'delete') {
    $id = (int)($input['id'] ?? 0);
    if ($id) {
        $stmt = $pdo->prepare('DELETE FROM maintenance_events WHERE id = ?');
        $stmt->execute([$id]);
        logEvent($pdo, $currentUser['user_id'], 'delete_maintenance', 'Deleted maintenance event #' . $id);
    }
    echo json_encode(['message' => 'Maintenance event deleted.']);
    exit;
}

http_response_code(400);
echo json_encode(['error' => 'Unknown action.']);