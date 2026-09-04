<?php
header('Content-Type: application/json');
require_once __DIR__ . '/../config/cors.php';

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }
if ($_SERVER['REQUEST_METHOD'] !== 'POST') { http_response_code(405); echo json_encode(['error' => 'Method not allowed']); exit; }

require_once __DIR__ . '/../middleware/auth.php';
require_once __DIR__ . '/../middleware/write_ratelimit.php';
$user = requireRole(['Staff', 'Admin', 'Super Admin']);
xevera_write_rate_limit($pdo, 'tasks.create');

require_once __DIR__ . '/../config/database.php';

$input = json_decode(file_get_contents('php://input'), true);
$title = trim($input['title'] ?? '');
$description = trim($input['description'] ?? '');
$column = trim($input['column'] ?? 'To Do');
$priority = trim($input['priority'] ?? 'Normal');
$assignedTo = isset($input['assigned_to']) && $input['assigned_to'] !== '' ? (int)$input['assigned_to'] : null;
$dueDate = trim($input['due_date'] ?? '') ?: null;

if (!$title) { http_response_code(400); echo json_encode(['error' => 'Task title is required.']); exit; }

$validColumns = ['To Do', 'In Progress', 'Done'];
if (!in_array($column, $validColumns, true)) { http_response_code(400); echo json_encode(['error' => 'Invalid column.']); exit; }

$validPriorities = ['Low', 'Normal', 'High', 'Urgent'];
if (!in_array($priority, $validPriorities, true)) { http_response_code(400); echo json_encode(['error' => 'Invalid priority.']); exit; }

if ($dueDate !== null && !preg_match('/^\d{4}-\d{2}-\d{2}$/', $dueDate)) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid due date.']);
    exit;
}

$stmt = $pdo->prepare('INSERT INTO tasks (title, description, `column`, priority, assigned_to, due_date, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)');
$stmt->execute([$title, $description, $column, $priority, $assignedTo, $dueDate, $user['user_id']]);
$taskId = (int)$pdo->lastInsertId();

$detail = 'Created task ' . $taskId . ' - ' . $title;
if ($assignedTo) $detail .= ' - assigned to user ' . $assignedTo;

$stmt = $pdo->prepare('INSERT INTO activity_logs (user_id, action, target_type, target_id, detail) VALUES (?, ?, ?, ?, ?)');
$stmt->execute([$user['user_id'], 'create_task', 'task', $taskId, $detail]);

echo json_encode(['success' => true, 'id' => $taskId]);