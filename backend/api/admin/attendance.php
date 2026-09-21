<?php
header('Content-Type: application/json');
require_once __DIR__ . '/../config/cors.php';

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }
if ($_SERVER['REQUEST_METHOD'] !== 'GET') { http_response_code(405); echo json_encode(['error' => 'Method not allowed']); exit; }

require_once __DIR__ . '/../middleware/auth.php';
$user = requirePermission('attendance', ['Admin', 'Super Admin']);

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../attendance/attendance_state.php';

$search = trim($_GET['search'] ?? '');
$dateFrom = $_GET['date_from'] ?? '';
$dateTo = $_GET['date_to'] ?? '';
$filter = $_GET['filter'] ?? 'all';
$page = max(1, (int)($_GET['page'] ?? 1));
$limit = min(100, max(1, (int)($_GET['limit'] ?? 20)));
$offset = ($page - 1) * $limit;

$where = [];
$params = [];

if ($search) {
    $where[] = '(u.name LIKE ? OR u.username LIKE ? OR u.email LIKE ?)';
    $params[] = "%$search%";
    $params[] = "%$search%";
    $params[] = "%$search%";
}

if ($filter === 'pending_time_in') {
    $where[] = 'a.time_in_status = "Pending"';
} elseif ($filter === 'pending_time_out') {
    $where[] = 'a.time_out_status = "Pending"';
}

if ($dateFrom) {
    $where[] = 'a.attendance_date >= ?';
    $params[] = $dateFrom;
}

if ($dateTo) {
    $where[] = 'a.attendance_date <= ?';
    $params[] = $dateTo;
}

$whereClause = $where ? 'WHERE ' . implode(' AND ', $where) : '';

$countStmt = $pdo->prepare('SELECT COUNT(*) FROM attendance a JOIN users u ON a.staff_id = u.id ' . $whereClause);
$countStmt->execute($params);
$total = (int)$countStmt->fetchColumn();

$stmt = $pdo->prepare('SELECT a.*, u.name AS staff_name, u.username, u.email, ac.requested_time_in as corrected_time_in, ac.requested_time_out as corrected_time_out, ac.status as correction_status, ac_pending.id as pending_correction_id, ia.name AS time_in_reviewer, oa.name AS time_out_reviewer FROM attendance a JOIN users u ON a.staff_id = u.id LEFT JOIN attendance_corrections ac ON ac.id = (SELECT id FROM attendance_corrections WHERE attendance_id = a.id AND status = "Approved" ORDER BY reviewed_at DESC LIMIT 1) LEFT JOIN attendance_corrections ac_pending ON ac_pending.id = (SELECT id FROM attendance_corrections WHERE attendance_id = a.id AND status = "Pending" ORDER BY created_at DESC LIMIT 1) LEFT JOIN users ia ON a.time_in_approved_by = ia.id LEFT JOIN users oa ON a.time_out_recorded_by = oa.id ' . $whereClause . ' ORDER BY a.attendance_date DESC LIMIT ? OFFSET ?');
$stmt->execute(array_merge($params, [$limit, $offset]));
$items = $stmt->fetchAll();

$result = array_map(function ($r) {
    $state = attendance_state($r);
    $tinApproved = ($r['time_in_status'] ?? null) === 'Approved' && !empty($r['time_in']);
    $toutApproved = ($r['time_out_status'] ?? null) === 'Approved' && !empty($r['time_out']);
    $correctionApproved = ($r['correction_status'] ?? null) === 'Approved';
    $officialTimeIn = ($correctionApproved && $r['corrected_time_in']) ? $r['corrected_time_in'] : $r['time_in'];
    $officialTimeOut = ($correctionApproved && $r['corrected_time_out']) ? $r['corrected_time_out'] : $r['time_out'];

    $requestedTimeIn = $state === 'PENDING_TIME_IN' ? $r['time_in'] : null;
    $requestedTimeOut = $state === 'PENDING_TIME_OUT' ? $r['time_out'] : null;
    $approvedTimeIn = $tinApproved ? $officialTimeIn : null;
    $approvedTimeOut = $toutApproved ? $officialTimeOut : null;

    $total = attendance_total($approvedTimeIn, $approvedTimeOut);
    $displayMinutes = $total['minutes'];
    $totalHours = $total['label'];

    $status = $r['status'];
    if ($correctionApproved) $status = 'Correction Approved';
    elseif (($r['correction_status'] ?? null) === 'Pending') $status = 'Correction Pending';
    else $status = attendance_status_label($state);

    return [
        'id' => (int)$r['id'],
        'staff_id' => (int)$r['staff_id'],
        'staff_name' => $r['staff_name'],
        'username' => $r['username'],
        'email' => $r['email'],
        'date' => $r['attendance_date'],
        'attendance_status' => $state,
        'time_in' => attendance_time_label($approvedTimeIn ?: $requestedTimeIn),
        'time_out' => attendance_time_label($approvedTimeOut ?: $requestedTimeOut),
        'requested_time_in' => $requestedTimeIn,
        'requested_time_out' => $requestedTimeOut,
        'approved_time_in' => $approvedTimeIn,
        'approved_time_out' => $approvedTimeOut,
        'time_in_label' => attendance_time_label($approvedTimeIn ?: $requestedTimeIn),
        'time_out_label' => attendance_time_label($approvedTimeOut ?: $requestedTimeOut),
        'status' => $status,
        'total_minutes' => $displayMinutes,
        'total_hours' => $totalHours,
        'time_in_status' => $r['time_in_status'],
        'time_out_status' => $r['time_out_status'],
        'time_in_recorded_at' => $r['time_in'],
        'time_out_recorded_at' => $r['time_out'],
        'time_in_approved_by' => $r['time_in_approved_by'] ? (int)$r['time_in_approved_by'] : null,
        'time_out_approved_by' => $r['time_out_approved_by'] ? (int)$r['time_out_approved_by'] : null,
        'time_out_source' => $r['time_out_source'],
        'time_out_recorded_by' => $r['time_out_recorded_by'] ? (int)$r['time_out_recorded_by'] : null,
        'time_out_reason' => $r['time_out_reason'],
        'correction_status' => $r['correction_status'] ?: null,
        'correction_id' => $r['pending_correction_id'] ? (int)$r['pending_correction_id'] : null,
        'time_in_reviewed_by' => $r['time_in_reviewer'] ?: null,
        'time_out_reviewed_by' => $r['time_out_reviewer'] ?: null,
    ];
}, $items);

echo json_encode(['items' => $result, 'total' => $total, 'page' => $page, 'limit' => $limit, 'total_pages' => max(1, (int)ceil($total / $limit))]);
