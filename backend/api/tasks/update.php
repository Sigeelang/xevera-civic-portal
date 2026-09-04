<?php
header('Content-Type: application/json');
require_once __DIR__ . '/../config/cors.php';

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }
if ($_SERVER['REQUEST_METHOD'] !== 'POST') { http_response_code(405); echo json_encode(['error' => 'Method not allowed']); exit; }

require_once __DIR__ . '/../middleware/auth.php';
require_once __DIR__ . '/../middleware/write_ratelimit.php';
$user = requireRole(['Staff', 'Admin', 'Super Admin']);
xevera_write_rate_limit($pdo, 'tasks.update');

require_once __DIR__ . '/../config/database.php';

$input = json_decode(file_get_contents('php://input'), true);
$id = (int)($input['id'] ?? 0);

if (!$id) { http_response_code(400); echo json_encode(['error' => 'Task ID is required.']); exit; }

$stmt = $pdo->prepare('SELECT * FROM tasks WHERE id = ?');
$stmt->execute([$id]);
$task = $stmt->fetch();

if (!$task) { http_response_code(404); echo json_encode(['error' => 'Task not found.']); exit; }

$updates = [];
$params = [];

if (array_key_exists('title', $input)) {
    $title = trim($input['title']);
    if (!$title) { http_response_code(400); echo json_encode(['error' => 'Task title is required.']); exit; }
    $updates[] = 'title = ?';
    $params[] = $title;
}

if (array_key_exists('description', $input)) {
    $updates[] = 'description = ?';
    $params[] = trim($input['description']);
}

if (array_key_exists('column', $input)) {
    $column = trim($input['column']);
    if (!in_array($column, ['To Do', 'In Progress', 'Done'], true)) {
        http_response_code(400);
        echo json_encode(['error' => 'Invalid column.']);
        exit;
    }
    $updates[] = '`column` = ?';
    $params[] = $column;
}

if (array_key_exists('priority', $input)) {
    $priority = trim($input['priority']);
    if (!in_array($priority, ['Low', 'Normal', 'High', 'Urgent'], true)) {
        http_response_code(400);
        echo json_encode(['error' => 'Invalid priority.']);
        exit;
    }
    $updates[] = 'priority = ?';
    $params[] = $priority;
}

if (array_key_exists('assigned_to', $input)) {
    $assignedTo = $input['assigned_to'] !== '' && $input['assigned_to'] !== null ? (int)$input['assigned_to'] : null;
    $updates[] = 'assigned_to = ?';
    $params[] = $assignedTo;
}

if (array_key_exists('due_date', $input)) {
    $dueDate = trim($input['due_date']) ?: null;
    if ($dueDate !== null && !preg_match('/^\d{4}-\d{2}-\d{2}$/', $dueDate)) {
        http_response_code(400);
        echo json_encode(['error' => 'Invalid due date.']);
        exit;
    }
    $updates[] = 'due_date = ?';
    $params[] = $dueDate;
}

if (empty($updates)) { echo json_encode(['message' => 'Nothing to update.']); exit; }

$params[] = $id;
$stmt = $pdo->prepare('UPDATE tasks SET ' . implode(', ', $updates) . ' WHERE id = ?');
$stmt->execute($params);

$changes = [];
if (array_key_exists('column', $input) && $input['column'] !== $task['column']) $changes[] = 'moved to ' . $input['column'];
if (array_key_exists('priority', $input) && $input['priority'] !== $task['priority']) $changes[] = 'priority: ' . $input['priority'];

$detail = 'Updated task ' . $id;
if (!empty($changes)) $detail .= ' - ' . implode(', ', $changes);

$stmt = $pdo->prepare('INSERT INTO activity_logs (user_id, action, target_type, target_id, detail) VALUES (?, ?, ?, ?, ?)');
$stmt->execute([$user['user_id'], 'update_task', 'task', $id, $detail]);

echo json_encode(['message' => 'Task updated successfully.']);