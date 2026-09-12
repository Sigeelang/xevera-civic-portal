<?php
/**
 * Online users endpoint.
 * 
 * GET /api/presence/online.php
 * Returns list of user IDs that are currently online (active in last 2 minutes).
 * Used by messaging UIs to show green/grey dots.
 */
header('Content-Type: application/json');
require_once __DIR__ . '/../config/cors.php';

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }

require_once __DIR__ . '/../middleware/auth.php';
$user = requireAuth();
require_once __DIR__ . '/../config/database.php';

try {
    // User is online if last_active_at is within the last 2 minutes
    $stmt = $pdo->query("SELECT id FROM users WHERE last_active_at > DATE_SUB(NOW(), INTERVAL 2 MINUTE)");
    $onlineIds = $stmt->fetchAll(PDO::FETCH_COLUMN);

    echo json_encode([
        'online_user_ids' => array_map('intval', $onlineIds),
        'checked_at' => date('Y-m-d H:i:s'),
    ]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Failed to check online status.']);
}
