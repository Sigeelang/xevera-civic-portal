<?php
header('Content-Type: application/json');
require_once __DIR__ . '/../config/cors.php';

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once __DIR__ . '/../middleware/auth.php';
require_once __DIR__ . '/../middleware/write_ratelimit.php';
$currentUser = requireRole(['Admin', 'Super Admin']);
xevera_write_rate_limit($pdo, 'maintenance.toggle');

require_once __DIR__ . '/../config/database.php';

$input = json_decode(file_get_contents('php://input'), true);
$enabled = $input['enabled'] ?? null;

if ($enabled === null || !is_bool($enabled)) {
    http_response_code(400);
    echo json_encode(['error' => 'enabled (true/false) is required.']);
    exit;
}

$value = $enabled ? '1' : '0';

$scheduledAt = $input['scheduled_at'] ?? null;
if ($scheduledAt !== null && $scheduledAt !== '' && strtotime($scheduledAt) === false) {
    http_response_code(400);
    echo json_encode(['error' => 'scheduled_at is invalid.']);
    exit;
}

if (!empty($scheduledAt)) {
    $scheduledAt = date('Y-m-d H:i:s', strtotime($scheduledAt));
}

$stmt = $pdo->prepare('INSERT INTO system_settings (`key`, `value`) VALUES (?, ?) ON DUPLICATE KEY UPDATE `value` = VALUES(`value`)');
$stmt->execute(['maintenance_mode', $value]);

$stmt->execute(['maintenance_enabled_by', $enabled ? 'manual' : 'manual_off']);

if ($scheduledAt !== null) {
    $stmt->execute(['maintenance_scheduled_at', $scheduledAt]);
}

// Record an event for audit when toggling manually (unless an explicit schedule exists)
$reason = trim((string)($input['reason'] ?? ''));
if ($enabled) {
    $end = $scheduledAt ? date('Y-m-d H:i:s', strtotime($scheduledAt)) : null;
    $stmt = $pdo->prepare('INSERT INTO maintenance_events (type, reason, start_at, end_at, status, created_by) VALUES (?, ?, ?, ?, ?, ?)');
    $stmt->execute(['manual', $reason ?: 'Manual maintenance', date('Y-m-d H:i:s'), $end, 'running', $currentUser['user_id']]);
} else {
    $stmt = $pdo->prepare("UPDATE maintenance_events SET status = 'completed', end_at = COALESCE(end_at, NOW()) WHERE status IN ('scheduled', 'running')");
    $stmt->execute();
}

$logStmt = $pdo->prepare('INSERT INTO activity_logs (user_id, action, target_type, target_id, detail) VALUES (?, ?, ?, NULL, ?)');
$logStmt->execute([
    $currentUser['user_id'],
    'toggle_maintenance',
    'settings',
    ($enabled ? 'Maintenance mode ON' : 'Maintenance mode OFF'),
]);

echo json_encode(['message' => 'Maintenance mode updated.', 'maintenance_mode' => $value]);