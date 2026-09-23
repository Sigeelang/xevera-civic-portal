<?php
header('Content-Type: application/json');
require_once __DIR__ . '/../config/cors.php';

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once __DIR__ . '/../middleware/auth.php';
requirePermission('activity', ['Staff', 'Admin', 'Super Admin']);

require_once __DIR__ . '/../config/database.php';

$page = max(1, (int)($_GET['page'] ?? 1));
$limit = max(1, min(50, (int)($_GET['limit'] ?? 20)));
$action = $_GET['action'] ?? '';
$search = trim($_GET['search'] ?? '');
$from = trim($_GET['from'] ?? '');
$to = trim($_GET['to'] ?? '');
$offset = ($page - 1) * $limit;

$where = [];
$params = [];

if ($action && $action !== 'All') {
    $where[] = 'al.action = ?';
    $params[] = $action;
}

// Security events shortcut: any failed/suspicious activity.
if ($action === '__security__') {
    $where[] = "al.action IN ('login_failed')";
}

if ($search) {
    $where[] = '(al.detail LIKE ? OR al.action LIKE ? OR u.name LIKE ? OR u.username LIKE ?)';
    $like = '%' . addcslashes($search, '%_\\') . '%';
    array_push($params, $like, $like, $like, $like);
}

if ($from && preg_match('/^\d{4}-\d{2}-\d{2}$/', $from)) {
    $where[] = 'al.created_at >= ?';
    $params[] = $from . ' 00:00:00';
}

if ($to && preg_match('/^\d{4}-\d{2}-\d{2}$/', $to)) {
    $where[] = 'al.created_at <= ?';
    $params[] = $to . ' 23:59:59';
}

$whereSql = $where ? 'WHERE ' . implode(' AND ', $where) : '';

$countStmt = $pdo->prepare("SELECT COUNT(*) FROM activity_logs al LEFT JOIN users u ON al.user_id = u.id $whereSql");
$countStmt->execute($params);
$total = (int)$countStmt->fetchColumn();
$totalPages = max(1, (int)ceil($total / $limit));

$stmt = $pdo->prepare("
    SELECT al.id, al.user_id, al.action, al.target_type, al.target_id, al.detail, al.ip_address, al.created_at,
           u.name AS user_name, u.username AS user_username, u.role AS user_role
    FROM activity_logs al
    LEFT JOIN users u ON al.user_id = u.id
    $whereSql
    ORDER BY al.created_at DESC
    LIMIT $limit OFFSET $offset
");
$stmt->execute($params);
$items = $stmt->fetchAll();

/* Overview statistics (unfiltered totals for the dashboard cards). */
$stats = [
    'total' => (int)$pdo->query('SELECT COUNT(*) FROM activity_logs')->fetchColumn(),
    'users_involved' => (int)$pdo->query('SELECT COUNT(DISTINCT user_id) FROM activity_logs WHERE user_id IS NOT NULL')->fetchColumn(),
    'today' => (int)$pdo->query("SELECT COUNT(*) FROM activity_logs WHERE created_at >= CURDATE()")->fetchColumn(),
    'security_events' => (int)$pdo->query("SELECT COUNT(*) FROM activity_logs WHERE action = 'login_failed'")->fetchColumn(),
];

echo json_encode([
    'items' => $items,
    'total' => $total,
    'page' => $page,
    'total_pages' => $totalPages,
    'stats' => $stats,
]);
