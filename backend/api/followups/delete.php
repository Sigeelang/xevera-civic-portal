<?php
header('Content-Type: application/json');
require_once __DIR__ . '/../config/cors.php';

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }
if ($_SERVER['REQUEST_METHOD'] !== 'POST') { http_response_code(405); echo json_encode(['error' => 'Method not allowed']); exit; }

require_once __DIR__ . '/../middleware/auth.php';
require_once __DIR__ . '/../middleware/write_ratelimit.php';
$user = requirePermission('tasks', ['Staff', 'Admin', 'Super Admin']);
xevera_write_rate_limit($pdo, 'followups.delete');

require_once __DIR__ . '/../config/database.php';

$input = json_decode(file_get_contents('php://input'), true);
$id = (int)($input['id'] ?? 0);

if (!$id) { http_response_code(400); echo json_encode(['error' => 'Follow-up ID is required.']); exit; }

$stmt = $pdo->prepare('SELECT * FROM follow_ups WHERE id = ?');
$stmt->execute([$id]);
$followUp = $stmt->fetch();

if (!$followUp) { http_response_code(404); echo json_encode(['error' => 'Follow-up not found.']); exit; }

$stmt = $pdo->prepare('DELETE FROM follow_ups WHERE id = ?');
$stmt->execute([$id]);

$stmt = $pdo->prepare('INSERT INTO activity_logs (user_id, action, target_type, target_id, detail) VALUES (?, ?, ?, ?, ?)');
$stmt->execute([$user['user_id'], 'delete_follow_up', 'follow_up', $id, 'Deleted follow-up ' . $followUp['ref_id'] . ' - ' . $followUp['title']]);

echo json_encode(['message' => 'Follow-up deleted.']);