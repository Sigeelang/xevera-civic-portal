<?php
require_once __DIR__ . '/../config/cors.php';

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }
if ($_SERVER['REQUEST_METHOD'] !== 'GET') { http_response_code(405); echo json_encode(['error' => 'Method not allowed']); exit; }

require_once __DIR__ . '/../middleware/auth.php';
$user = requirePermission('attendance', ['Admin', 'Super Admin']);

require_once __DIR__ . '/../config/database.php';

$search = trim($_GET['search'] ?? '');
$dateFrom = trim($_GET['date_from'] ?? '');
$dateTo = trim($_GET['date_to'] ?? '');
$status = $_GET['status'] ?? 'All';

$where = [];
$params = [];

if ($search !== '') {
    $where[] = '(u.name LIKE ? OR u.username LIKE ? OR u.email LIKE ?)';
    $params[] = "%$search%";
    $params[] = "%$search%";
    $params[] = "%$search%";
}
if ($dateFrom !== '' && preg_match('/^\d{4}-\d{2}-\d{2}$/', $dateFrom)) { $where[] = 'a.attendance_date >= ?'; $params[] = $dateFrom; }
if ($dateTo !== '' && preg_match('/^\d{4}-\d{2}-\d{2}$/', $dateTo)) { $where[] = 'a.attendance_date <= ?'; $params[] = $dateTo; }
if ($status !== 'All' && $status !== '') { $where[] = 'a.status = ?'; $params[] = $status; }
$whereClause = $where ? 'WHERE ' . implode(' AND ', $where) : '';

$stmt = $pdo->prepare("SELECT a.*, u.name AS staff_name, u.username AS staff_username,
    ia.name AS time_in_approved_name, oa.name AS time_out_approved_name
    FROM attendance a
    JOIN users u ON a.staff_id = u.id
    LEFT JOIN users ia ON a.time_in_approved_by = ia.id
    LEFT JOIN users oa ON a.time_out_approved_by = oa.id
    $whereClause ORDER BY a.attendance_date DESC");
$stmt->execute($params);
$rows = $stmt->fetchAll();

if (count($rows) === 0) {
    http_response_code(404);
    header('Content-Type: application/json');
    echo json_encode(['error' => 'No attendance records found for the selected filters.']);
    exit;
}

$log = $pdo->prepare('INSERT INTO activity_logs (user_id, action, target_type, target_id, detail) VALUES (?, ?, ?, NULL, ?)');
$log->execute([(int)$user['user_id'], 'EXPORT_ATTENDANCE_CSV', 'attendance_export', 'csv export of ' . count($rows) . ' attendance records']);

header('Content-Type: text/csv; charset=utf-8');
header('Content-Disposition: attachment; filename="xevera-attendance-' . date('Y-m-d') . '.csv"');
$output = fopen('php://output', 'w');
fwrite($output, "\xEF\xBB\xBF");
fputcsv($output, ['Staff', 'Username', 'Date', 'Time In', 'Time Out', 'Duration', 'Status', 'Approved By']);

foreach ($rows as $r) {
    $timeIn = $r['time_in'] ? date('g:i A', strtotime($r['time_in'])) : '—';
    $timeOut = $r['time_out'] ? date('g:i A', strtotime($r['time_out'])) : '—';
    $minutes = (int)$r['total_minutes'];
    $duration = $minutes > 0 ? floor($minutes / 60) . 'h ' . ($minutes % 60) . 'm' : '—';
    $approvedBy = $r['time_out_approved_name'] ?: ($r['time_in_approved_name'] ?: '—');
    fputcsv($output, [$r['staff_name'], $r['staff_username'], $r['attendance_date'], $timeIn, $timeOut, $duration, $r['status'], $approvedBy]);
}

fclose($output);