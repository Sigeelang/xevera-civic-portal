<?php
header('Content-Type: application/json');
require_once __DIR__ . '/../config/cors.php';
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

require_once __DIR__ . '/../middleware/auth.php';
$user = requireRole(['Admin', 'Super Admin']);

require_once __DIR__ . '/../config/database.php';

$input = json_decode(file_get_contents('php://input'), true);
$userId = $input['user_id'] ?? null;
$type = $input['type'] ?? 'reminder';
$message = $input['message'] ?? '';
$reportId = $input['report_id'] ?? null;

if (!$userId || !$message) {
    http_response_code(400);
    echo json_encode(['error' => 'user_id and message are required']);
    exit;
}

$stmt = $pdo->prepare("INSERT INTO notifications (user_id, type, message, report_id, is_read, created_at) VALUES (?, ?, ?, ?, 0, NOW())");
$stmt->execute([$userId, $type, $message, $reportId]);

echo json_encode(['success' => true, 'id' => (int)$pdo->lastInsertId()]);
