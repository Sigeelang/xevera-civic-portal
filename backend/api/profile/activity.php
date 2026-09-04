<?php
header('Content-Type: application/json');
require_once __DIR__ . '/../config/cors.php';

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

require_once __DIR__ . '/../middleware/auth.php';
$user = requireAuth();
require_once __DIR__ . '/../config/database.php';

$uid = (int)$user['user_id'];
$stmt = $pdo->prepare("SELECT id, action, target_type, detail, created_at FROM activity_logs WHERE user_id = ? ORDER BY created_at DESC LIMIT 50");
$stmt->execute([$uid]);
echo json_encode(['items' => $stmt->fetchAll()]);