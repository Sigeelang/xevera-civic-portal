<?php
header('Content-Type: text/csv; charset=utf-8');
require_once __DIR__ . '/../config/cors.php';
header('Content-Disposition: attachment; filename="activity_export.csv"');

require_once __DIR__ . '/../middleware/auth.php';
requirePermission('exports', ['Admin', 'Super Admin']);

require_once __DIR__ . '/../config/database.php';

$action = $_GET['action'] ?? '';
$q = trim($_GET['q'] ?? '');
$from = trim($_GET['from'] ?? '');
$to = trim($_GET['to'] ?? '');

$conds = [];
$params = [];

if ($action && $action !== 'All') { $conds[] = 'al.action = ?'; $params[] = $action; }
if ($q !== '') {
    $conds[] = '(u.name LIKE ? OR u.username LIKE ? OR al.action LIKE ? OR al.detail LIKE ?)';
    $qq = "%$q%";
    array_push($params, $qq, $qq, $qq, $qq);
}
if ($from !== '') { $conds[] = 'DATE(al.created_at) >= ?'; $params[] = $from; }
if ($to !== '') { $conds[] = 'DATE(al.created_at) <= ?'; $params[] = $to; }

$where = $conds ? 'WHERE ' . implode(' AND ', $conds) : '';

$stmt = $pdo->prepare("SELECT al.created_at, COALESCE(u.name, 'System') AS user_name, u.username, u.role, al.action, al.target_type, al.target_id, al.detail FROM activity_logs al LEFT JOIN users u ON al.user_id = u.id $where ORDER BY al.created_at DESC");
$stmt->execute($params);
$rows = $stmt->fetchAll();

$output = fopen('php://output', 'w');
fputcsv($output, ['Time', 'User', 'Username', 'Role', 'Action', 'Target Type', 'Target ID', 'Detail']);

foreach ($rows as $r) {
    fputcsv($output, [
        $r['created_at'],
        $r['user_name'],
        $r['username'] ?? '',
        $r['role'] ?? '',
        $r['action'],
        $r['target_type'] ?? '',
        $r['target_id'] ?? '',
        $r['detail'] ?? '',
    ]);
}

fclose($output);