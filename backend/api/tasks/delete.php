<?php
header('Content-Type: application/json');
require_once __DIR__ . '/../config/cors.php';

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }
if ($_SERVER['REQUEST_METHOD'] !== 'POST') { http_response_code(405); echo json_encode(['error' => 'Method not allowed']); exit; }

require_once __DIR__ . '/../middleware/auth.php';
require_once __DIR__ . '/../middleware/write_ratelimit.php';
$user = requirePermission('tasks', ['Staff', 'Admin', 'Super Admin']);
xevera_write_rate_limit($pdo, 'tasks.delete');

require_once __DIR__ . '/../config/database.php';

$input = json_decode(file_get_contents('php://input'), true);
$id = (int)($input['id'] ?? 0);

if (!$id) { http_response_code(400); echo json_encode(['error' => 'Task ID is required.']); exit; }

$stmt = $pdo->prepare('SELECT title FROM tasks WHERE id = ?');
$stmt->execute([$id]);
$task = $stmt->fetch();

if (!$task) { http_response_code(404); echo json_encode(['error' => 'Task not found.']); exit; }

$stmt = $pdo->prepare('DELETE FROM tasks WHERE id = ?');
$stmt->execute([$id]);

$stmt = $pdo->prepare('INSERT INTO activity_logs (user_id, action, target_type, target_id, detail) VALUES (?, ?, ?, ?, ?)');
$stmt->execute([$user['user_id'], 'delete_task', 'task', $id, 'Deleted task ' . $id . ' - ' . $task['title']]);

echo json_encode(['message' => 'Task deleted successfully.']);