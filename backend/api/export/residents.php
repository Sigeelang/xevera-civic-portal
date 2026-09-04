<?php
require_once __DIR__ . '/../config/cors.php';

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }
if ($_SERVER['REQUEST_METHOD'] !== 'GET') { http_response_code(405); echo json_encode(['error' => 'Method not allowed']); exit; }

require_once __DIR__ . '/../middleware/auth.php';
$user = requireRole(['Admin', 'Super Admin']);

require_once __DIR__ . '/../config/database.php';

$q = trim($_GET['search'] ?? '');
$status = $_GET['status'] ?? 'All';

$conds = ["role = 'Resident'"];
$params = [];

if ($q !== '') {
    $conds[] = '(name LIKE ? OR email LIKE ? OR username LIKE ?)';
    $qq = "%$q%";
    array_push($params, $qq, $qq, $qq);
}
if ($status !== 'All' && $status !== '') { $conds[] = 'status = ?'; $params[] = $status; }

$where = 'WHERE ' . implode(' AND ', $conds);

$stmt = $pdo->prepare("SELECT name, username, email, address, status, created_at FROM users $where ORDER BY created_at DESC");
$stmt->execute($params);
$rows = $stmt->fetchAll();

if (count($rows) === 0) {
    http_response_code(404);
    header('Content-Type: application/json');
    echo json_encode(['error' => 'No residents found for the selected filters.']);
    exit;
}

$log = $pdo->prepare('INSERT INTO activity_logs (user_id, action, target_type, target_id, detail) VALUES (?, ?, ?, NULL, ?)');
$log->execute([(int)$user['user_id'], 'EXPORT_RESIDENTS_CSV', 'residents_export', 'csv export of ' . count($rows) . ' resident records']);

header('Content-Type: text/csv; charset=utf-8');
header('Content-Disposition: attachment; filename="xevera-residents-' . date('Y-m-d') . '.csv"');
$output = fopen('php://output', 'w');
fwrite($output, "\xEF\xBB\xBF");
fputcsv($output, ['Name', 'Username', 'Email', 'Address', 'Status', 'Date Registered']);

foreach ($rows as $r) {
    fputcsv($output, [$r['name'], $r['username'], $r['email'], $r['address'] ?? '', $r['status'], $r['created_at']]);
}

fclose($output);