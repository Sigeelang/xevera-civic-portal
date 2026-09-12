<?php
/**
 * Presence heartbeat endpoint.
 * 
 * POST /api/presence/heartbeat.php
 * Authenticated users call this every 30s to update their last_active_at.
 * This is lightweight - just updates a timestamp.
 */
header('Content-Type: application/json');
require_once __DIR__ . '/../config/cors.php';

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }
if ($_SERVER['REQUEST_METHOD'] !== 'POST') { http_response_code(405); echo json_encode(['error' => 'Method not allowed']); exit; }

require_once __DIR__ . '/../middleware/auth.php';
$user = requireAuth();
require_once __DIR__ . '/../config/database.php';

$uid = (int) $user['user_id'];

try {
    $stmt = $pdo->prepare('UPDATE users SET last_active_at = NOW() WHERE id = ?');
    $stmt->execute([$uid]);
    echo json_encode(['ok' => true, 'time' => date('Y-m-d H:i:s')]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Failed to update presence.']);
}
