<?php
header('Content-Type: application/json');
require_once __DIR__ . '/../config/cors.php';

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }
if ($_SERVER['REQUEST_METHOD'] !== 'GET') { http_response_code(405); echo json_encode(['error' => 'Method not allowed']); exit; }

require_once __DIR__ . '/../middleware/auth.php';
$user = requireAuth();
$role = $user['role'] ?? '';

if (!in_array($role, ['Staff', 'Admin', 'Super Admin', 'Resident'], true)) {
    http_response_code(403);
    echo json_encode(['error' => 'Forbidden. You do not have permission to access this resource.']);
    exit;
}

$isResident = $role === 'Resident';

require_once __DIR__ . '/../config/database.php';

$q = trim($_GET['search'] ?? '');
$status = $_GET['status'] ?? null;
$priority = $_GET['priority'] ?? null;
$assignedTo = $_GET['assigned_to'] ?? null;
$page = max(1, (int)($_GET['page'] ?? 1));
$limit = min(100, max(1, (int)($_GET['limit'] ?? 50)));
$offset = ($page - 1) * $limit;

$where = [];
$params = [];

// Residents can only see their own submissions.
if ($isResident) {
    $where[] = 'sr.resident_email = ?';
    $params[] = $user['email'] ?? '';
}

if ($q) {
    $where[] = '(sr.title LIKE ? OR sr.resident_name LIKE ? OR sr.ref_id LIKE ? OR sr.location LIKE ?)';
    $params[] = "%$q%";
    $params[] = "%$q%";
    $params[] = "%$q%";
    $params[] = "%$q%";
}

if ($status && $status !== 'All') {
    $where[] = 'sr.status = ?';
    $params[] = $status;
}

if ($priority && $priority !== 'All') {
    $where[] = 'sr.priority = ?';
    $params[] = $priority;
}

if ($assignedTo === 'me' && isset($user['user_id'])) {
    $where[] = 'sr.assigned_to = ?';
    $params[] = (int)$user['user_id'];
} elseif ($assignedTo === 'none') {
    $where[] = 'sr.assigned_to IS NULL';
} elseif ($assignedTo !== null && $assignedTo !== '' && $assignedTo !== 'all') {
    $where[] = 'sr.assigned_to = ?';
    $params[] = (int)$assignedTo;
}

$whereClause = $where ? 'WHERE ' . implode(' AND ', $where) : '';

$countStmt = $pdo->prepare("SELECT COUNT(*) FROM service_requests sr $whereClause");
$countStmt->execute($params);
$total = (int)$countStmt->fetchColumn();

$stmt = $pdo->prepare("
    SELECT sr.*, u.name AS assigned_name
    FROM service_requests sr
    LEFT JOIN users u ON sr.assigned_to = u.id
    $whereClause
    ORDER BY
        CASE sr.priority WHEN 'Urgent' THEN 0 WHEN 'High' THEN 1 WHEN 'Normal' THEN 2 ELSE 3 END,
        CASE sr.status WHEN 'Completed' THEN 1 WHEN 'Cancelled' THEN 2 ELSE 0 END,
        sr.created_at DESC
    LIMIT $limit OFFSET $offset
");
$stmt->execute($params);
$rows = $stmt->fetchAll();

echo json_encode([
    'items' => array_map(function ($r) {
        return [
            'id' => (int)$r['id'],
            'ref_id' => $r['ref_id'],
            'title' => $r['title'],
            'category' => $r['category'] ?? '',
            'location' => $r['location'] ?? '',
            'resident_name' => $r['resident_name'] ?? '',
            'resident_email' => $r['resident_email'] ?? '',
            'resident_phone' => $r['resident_phone'] ?? '',
            'priority' => $r['priority'],
            'status' => $r['status'],
            'assigned_to' => $r['assigned_to'] !== null ? (int)$r['assigned_to'] : null,
            'assigned_name' => $r['assigned_name'] ?? 'Unassigned',
            'notes' => $r['notes'] ?? '',
            'is_demo' => (int)$r['is_demo'],
            'created_at' => $r['created_at'],
            'date' => date('M j, Y', strtotime($r['created_at'])),
        ];
    }, $rows),
    'total' => $total,
    'page' => $page,
    'limit' => $limit,
    'total_pages' => max(1, (int)ceil($total / $limit)),
]);