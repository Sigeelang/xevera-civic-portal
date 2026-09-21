<?php
header('Content-Type: application/json');
require_once __DIR__ . '/../config/cors.php';

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }
if ($_SERVER['REQUEST_METHOD'] !== 'GET') { http_response_code(405); echo json_encode(['error' => 'Method not allowed']); exit; }

require_once __DIR__ . '/../middleware/auth.php';
$user = requirePermission('tasks', ['Staff', 'Admin', 'Super Admin']);

require_once __DIR__ . '/../config/database.php';

$q = trim($_GET['search'] ?? '');
$column = $_GET['column'] ?? 'All';
$assignedTo = $_GET['assigned_to'] ?? null;
$page = max(1, (int)($_GET['page'] ?? 1));
$limit = min(100, max(1, (int)($_GET['limit'] ?? 50)));
$offset = ($page - 1) * $limit;

$where = [];
$params = [];

if ($q) {
    $where[] = '(t.title LIKE ? OR t.description LIKE ?)';
    $params[] = "%$q%";
    $params[] = "%$q%";
}

if ($column !== 'All') {
    $where[] = 't.`column` = ?';
    $params[] = $column;
}

if ($assignedTo !== null) {
    if ($assignedTo === 'me' && isset($user['user_id'])) {
        $where[] = 't.assigned_to = ?';
        $params[] = (int)$user['user_id'];
    } elseif ($assignedTo === 'none') {
        $where[] = 't.assigned_to IS NULL';
    } elseif ($assignedTo !== '' && $assignedTo !== 'all') {
        $where[] = 't.assigned_to = ?';
        $params[] = (int)$assignedTo;
    }
}

$whereClause = $where ? 'WHERE ' . implode(' AND ', $where) : '';

$countStmt = $pdo->prepare("SELECT COUNT(*) FROM tasks t $whereClause");
$countStmt->execute($params);
$total = (int)$countStmt->fetchColumn();

$stmt = $pdo->prepare("
    SELECT t.*, u.name AS assigned_name, c.name AS creator_name
    FROM tasks t
    LEFT JOIN users u ON t.assigned_to = u.id
    LEFT JOIN users c ON t.created_by = c.id
    $whereClause
    ORDER BY
        CASE t.priority WHEN 'Urgent' THEN 0 WHEN 'High' THEN 1 WHEN 'Normal' THEN 2 ELSE 3 END,
        CASE WHEN t.due_date IS NULL THEN 1 ELSE 0 END,
        t.due_date ASC,
        t.created_at DESC
    LIMIT $limit OFFSET $offset
");
$stmt->execute($params);
$rows = $stmt->fetchAll();

echo json_encode([
    'items' => array_map(function ($t) {
        return [
            'id' => (int)$t['id'],
            'title' => $t['title'],
            'description' => $t['description'] ?? '',
            'column' => $t['column'],
            'priority' => $t['priority'],
            'assigned_to' => $t['assigned_to'] !== null ? (int)$t['assigned_to'] : null,
            'assigned_name' => $t['assigned_name'] ?? 'Unassigned',
            'due_date' => $t['due_date'],
            'due_display' => $t['due_date'] ? date('M j, Y', strtotime($t['due_date'])) : null,
            'overdue' => $t['due_date'] !== null && $t['column'] !== 'Done' && strtotime($t['due_date']) < strtotime('today'),
            'creator' => $t['creator_name'] ?? '',
            'created_at' => $t['created_at'],
            'date' => date('M j, Y', strtotime($t['created_at'])),
        ];
    }, $rows),
    'total' => $total,
    'page' => $page,
    'limit' => $limit,
    'total_pages' => max(1, (int)ceil($total / $limit)),
]);