<?php
header('Content-Type: application/json');
require_once __DIR__ . '/../config/cors.php';
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../middleware/auth.php';

$user = requireRole(['Admin', 'Super Admin']);

$page = max(1, (int)($_GET['page'] ?? 1));
$limit = min(100, max(1, (int)($_GET['limit'] ?? 20)));
$offset = ($page - 1) * $limit;
$status = $_GET['status'] ?? 'All';
$severity = $_GET['severity'] ?? 'All';
$type = $_GET['type'] ?? 'All';
$q = trim($_GET['search'] ?? '');
$dateFrom = $_GET['date_from'] ?? '';
$dateTo = $_GET['date_to'] ?? '';

$where = [];
$params = [];

if ($status !== 'All') { $where[] = 'v.status = ?'; $params[] = $status; }
if ($severity !== 'All') { $where[] = 'v.severity = ?'; $params[] = $severity; }
if ($type !== 'All') { $where[] = 'v.violation_type = ?'; $params[] = $type; }
if ($dateFrom !== '' && $dateTo !== '') {
    $where[] = 'DATE(v.created_at) BETWEEN ? AND ?';
    $params[] = $dateFrom; $params[] = $dateTo;
} elseif ($dateFrom !== '') {
    $where[] = 'DATE(v.created_at) >= ?'; $params[] = $dateFrom;
} elseif ($dateTo !== '') {
    $where[] = 'DATE(v.created_at) <= ?'; $params[] = $dateTo;
}
if ($q !== '') {
    $where[] = '(u.name LIKE ? OR u.email LIKE ? OR v.description LIKE ?)';
    $like = "%$q%"; $params[] = $like; $params[] = $like; $params[] = $like;
}

$whereClause = $where ? 'WHERE ' . implode(' AND ', $where) : '';

$countStmt = $pdo->prepare("SELECT COUNT(*) FROM violations v JOIN users u ON v.resident_id = u.id $whereClause");
$countStmt->execute($params);
$total = (int)$countStmt->fetchColumn();

$stmt = $pdo->prepare("
    SELECT v.*, u.name AS resident_name, u.email AS resident_email, u.violation_count,
           ib.name AS issued_by_name, rb.name AS appeal_reviewed_by_name,
           r.ref_id AS report_ref_id
    FROM violations v
    JOIN users u ON v.resident_id = u.id
    LEFT JOIN users ib ON v.issued_by = ib.id
    LEFT JOIN users rb ON v.appeal_reviewed_by = rb.id
    LEFT JOIN reports r ON v.report_id = r.id
    $whereClause
    ORDER BY v.created_at DESC
    LIMIT $limit OFFSET $offset
");
$stmt->execute($params);
$items = $stmt->fetchAll();

echo json_encode([
    'items' => $items,
    'total' => $total,
    'page' => $page,
    'limit' => $limit,
    'total_pages' => max(1, (int)ceil($total / $limit)),
]);
