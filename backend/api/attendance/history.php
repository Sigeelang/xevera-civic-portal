<?php
header('Content-Type: application/json');
require_once __DIR__ . '/../config/cors.php';

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }
if ($_SERVER['REQUEST_METHOD'] !== 'GET') { http_response_code(405); echo json_encode(['error' => 'Method not allowed']); exit; }

require_once __DIR__ . '/../middleware/auth.php';
$user = requireAuth();
$role = $user['role'] ?? '';

if (!in_array($role, ['Staff', 'Admin', 'Super Admin'], true)) {
    http_response_code(403);
    echo json_encode(['error' => 'Forbidden. Staff access required.']);
    exit;
}

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/attendance_state.php';

$uid = (int)$user['user_id'];
$limit = min(50, max(1, (int)($_GET['limit'] ?? 30)));
$dateFrom = $_GET['date_from'] ?? '';
$dateTo = $_GET['date_to'] ?? '';
if ($dateFrom !== '' && !preg_match('/^\d{4}-\d{2}-\d{2}$/', $dateFrom)) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid date_from format. Use YYYY-MM-DD.']);
    exit;
}
if ($dateTo !== '' && !preg_match('/^\d{4}-\d{2}-\d{2}$/', $dateTo)) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid date_to format. Use YYYY-MM-DD.']);
    exit;
}

$targetStaffId = $uid;
if (in_array($role, ['Admin', 'Super Admin'], true) && isset($_GET['staff_id'])) {
    $targetStaffId = (int)$_GET['staff_id'];
}

$where = ['a.staff_id = ?'];
$params = [$targetStaffId];

if ($dateFrom) { $where[] = 'a.attendance_date >= ?'; $params[] = $dateFrom; }
if ($dateTo) { $where[] = 'a.attendance_date <= ?'; $params[] = $dateTo; }

$whereClause = implode(' AND ', $where);
// $limit is int-cast above: interpolate instead of binding, since MySQL
// native prepares reject LIMIT placeholders as strings.

$stmt = $pdo->prepare("SELECT a.*, ac.requested_time_in as corrected_time_in, ac.requested_time_out as corrected_time_out, ac.status as correction_status, ia.name AS time_in_reviewer, oa.name AS time_out_reviewer FROM attendance a LEFT JOIN attendance_corrections ac ON ac.id = (SELECT id FROM attendance_corrections WHERE attendance_id = a.id AND status = \"Approved\" ORDER BY reviewed_at DESC LIMIT 1) LEFT JOIN users ia ON a.time_in_approved_by = ia.id LEFT JOIN users oa ON a.time_out_recorded_by = oa.id WHERE $whereClause ORDER BY a.attendance_date DESC LIMIT $limit");
$stmt->execute($params);
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

    $status = $r['status'];
    if ($correctionApproved) $status = 'Correction Approved';
    elseif (($r['correction_status'] ?? null) === 'Pending') $status = 'Correction Pending';
    else $status = attendance_status_label($state);

    return [
        'id' => (int)$r['id'],
        'staff_id' => (int)$r['staff_id'],
        'date' => $r['attendance_date'],
        'attendance_status' => $state,
        'time_in' => attendance_time_label($approvedTimeIn ?: $requestedTimeIn),
        'time_out' => attendance_time_label($approvedTimeOut ?: $requestedTimeOut),
        'requested_time_in' => $requestedTimeIn,
        'requested_time_out' => $requestedTimeOut,
        'approved_time_in' => $approvedTimeIn,
        'approved_time_out' => $approvedTimeOut,
        'status' => $status,
        'total_minutes' => $total['minutes'],
        'total_hours' => $total['label'],
        'time_in_status' => $r['time_in_status'],
        'time_out_status' => $r['time_out_status'],
        'time_out_source' => $r['time_out_source'],
        'time_out_recorded_by' => $r['time_out_recorded_by'] ? (int)$r['time_out_recorded_by'] : null,
        'time_in_reviewed_by' => $r['time_in_reviewer'] ?: null,
        'time_out_reviewed_by' => $r['time_out_reviewer'] ?: null,
        'time_out_reason' => $r['time_out_reason'],
        'correction_status' => $r['correction_status'] ?: null,
    ];
}, $items);

echo json_encode(['items' => $result, 'total' => count($result)]);
