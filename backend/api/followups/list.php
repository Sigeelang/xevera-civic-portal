<?php
header('Content-Type: application/json');
require_once __DIR__ . '/../config/cors.php';

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }
if ($_SERVER['REQUEST_METHOD'] !== 'GET') { http_response_code(405); echo json_encode(['error' => 'Method not allowed']); exit; }

require_once __DIR__ . '/../middleware/auth.php';
$user = requireRole(['Staff', 'Admin', 'Super Admin']);

require_once __DIR__ . '/../config/database.php';

$q = trim($_GET['search'] ?? '');
$status = $_GET['status'] ?? null;
$priority = $_GET['priority'] ?? null;
$owner = $_GET['owner'] ?? null;
$page = max(1, (int)($_GET['page'] ?? 1));
$limit = min(100, max(1, (int)($_GET['limit'] ?? 50)));
$offset = ($page - 1) * $limit;

$where = [];
$params = [];

if ($q) {
    $where[] = '(f.title LIKE ? OR f.ref_id LIKE ? OR f.notes LIKE ? OR COALESCE(r.ref_id, CONCAT("Concern #", f.related_id)) LIKE ?)';
    $params[] = "%$q%";
    $params[] = "%$q%";
    $params[] = "%$q%";
    $params[] = "%$q%";
}

if ($status && $status !== 'All') {
    $where[] = 'f.status = ?';
    $params[] = $status;
}

if ($priority && $priority !== 'All') {
    $where[] = 'f.priority = ?';
    $params[] = $priority;
}

if ($owner === 'me' && isset($user['user_id'])) {
    $where[] = 'f.owner_id = ?';
    $params[] = (int)$user['user_id'];
} elseif ($owner !== null && $owner !== '' && $owner !== 'all') {
    $where[] = 'f.owner_id = ?';
    $params[] = (int)$owner;
}

$whereClause = $where ? 'WHERE ' . implode(' AND ', $where) : '';

$countStmt = $pdo->prepare("SELECT COUNT(*) FROM follow_ups f $whereClause");
$countStmt->execute($params);
$total = (int)$countStmt->fetchColumn();

$stmt = $pdo->prepare("
    SELECT f.*, u.name AS owner_name, r.ref_id AS report_ref, r.title AS report_title, c.subject AS concern_subject, c.name AS concern_name
    FROM follow_ups f
    LEFT JOIN reports r ON f.related_type = 'report' AND f.related_id = r.id
    LEFT JOIN contact_messages c ON f.related_type = 'concern' AND f.related_id = c.id
    LEFT JOIN users u ON f.owner_id = u.id
    $whereClause
    ORDER BY
        CASE f.status WHEN 'Completed' THEN 1 ELSE 0 END,
        CASE f.priority WHEN 'Urgent' THEN 0 WHEN 'High' THEN 1 WHEN 'Normal' THEN 2 ELSE 3 END,
        CASE WHEN f.due_date IS NULL THEN 1 ELSE 0 END,
        f.due_date ASC,
        f.created_at DESC
    LIMIT $limit OFFSET $offset
");
$stmt->execute($params);
$rows = $stmt->fetchAll();

echo json_encode([
    'items' => array_map(function ($f) {
        $relatedRef = $f['report_ref'] ?? ('Concern #' . $f['related_id']);
        $relatedTitle = $f['report_title'] ?? ($f['concern_subject'] ?: ($f['concern_name'] ?: ''));
        $due = $f['due_date'] ? date('Y-m-d', strtotime($f['due_date'])) : null;
        return [
            'id' => (int)$f['id'],
            'ref_id' => $f['ref_id'],
            'title' => $f['title'],
            'related_type' => $f['related_type'],
            'related_id' => (int)$f['related_id'],
            'related_ref' => $relatedRef,
            'related_title' => $relatedTitle,
            'due_date' => $due,
            'due_display' => $due ? date('M j, Y', strtotime($due)) : null,
            'overdue' => $due !== null && $f['status'] !== 'Completed' && strtotime($due) < strtotime('today'),
            'owner_id' => $f['owner_id'] !== null ? (int)$f['owner_id'] : null,
            'owner_name' => $f['owner_name'] ?? 'Unassigned',
            'priority' => $f['priority'],
            'status' => $f['status'],
            'notes' => $f['notes'] ?? '',
            'is_demo' => (int)$f['is_demo'],
            'completed_at' => $f['completed_at'],
            'created_at' => $f['created_at'],
            'date' => date('M j, Y', strtotime($f['created_at'])),
        ];
    }, $rows),
    'total' => $total,
    'page' => $page,
    'limit' => $limit,
    'total_pages' => max(1, (int)ceil($total / $limit)),
]);