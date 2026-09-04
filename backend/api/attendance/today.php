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
$today = date('Y-m-d');

$targetStaffId = $uid;
if (in_array($role, ['Admin', 'Super Admin'], true) && isset($_GET['staff_id'])) {
    $targetStaffId = (int)$_GET['staff_id'];
}

$stmt = $pdo->prepare('SELECT a.*, ac.requested_time_in as corrected_time_in, ac.requested_time_out as corrected_time_out, ac.status as correction_status, ia.name AS time_in_reviewer, oa.name AS time_out_reviewer FROM attendance a LEFT JOIN attendance_corrections ac ON ac.id = (SELECT id FROM attendance_corrections WHERE attendance_id = a.id AND status = "Approved" ORDER BY reviewed_at DESC LIMIT 1) LEFT JOIN users ia ON a.time_in_approved_by = ia.id LEFT JOIN users oa ON a.time_out_recorded_by = oa.id WHERE a.staff_id = ? AND a.attendance_date = ?');
$stmt->execute([$targetStaffId, $today]);
$record = $stmt->fetch();

if (!$record) {
    echo json_encode([
        'id' => null,
        'staff_id' => $targetStaffId,
        'date' => $today,
        'attendance_status' => 'NOT_TIMED_IN',
        'status' => 'Not Started',
        'requested_time_in' => null,
        'approved_time_in' => null,
        'requested_time_out' => null,
        'approved_time_out' => null,
        'time_in' => null,
        'time_out' => null,
        'time_in_label' => null,
        'time_out_label' => null,
        'time_in_status' => null,
        'time_out_status' => null,
        'total_minutes' => null,
        'total_hours' => null,
        'pending_time_in' => false,
        'pending_time_out' => false,
        'can_time_in' => true,
        'can_time_out' => false,
        'can_cancel' => false,
        'correction_status' => null,
        'time_out_source' => null,
        'time_out_recorded_by' => null,
        'time_in_reviewed_by' => null,
        'time_out_reviewed_by' => null,
        'time_out_reason' => null,
    ]);
    exit;
}

$state = attendance_state($record);
$tinApproved = ($record['time_in_status'] ?? null) === 'Approved' && !empty($record['time_in']);
$toutApproved = ($record['time_out_status'] ?? null) === 'Approved' && !empty($record['time_out']);

// Approved corrections override the official displayed timestamps.
$correctionApproved = ($record['correction_status'] ?? null) === 'Approved';
$officialTimeIn = ($correctionApproved && $record['corrected_time_in']) ? $record['corrected_time_in'] : $record['time_in'];
$officialTimeOut = ($correctionApproved && $record['corrected_time_out']) ? $record['corrected_time_out'] : $record['time_out'];

$requestedTimeIn = $state === 'PENDING_TIME_IN' ? $record['time_in'] : null;
$requestedTimeOut = $state === 'PENDING_TIME_OUT' ? $record['time_out'] : null;
$approvedTimeIn = $tinApproved ? $officialTimeIn : null;
$approvedTimeOut = $toutApproved ? $officialTimeOut : null;

$timeInLabel = $state === 'NOT_TIMED_IN' ? null : attendance_time_label($requestedTimeIn ?: $approvedTimeIn);
$timeOutLabel = $state === 'TIMED_OUT' ? attendance_time_label($approvedTimeOut) : ($state === 'PENDING_TIME_OUT' ? attendance_time_label($requestedTimeOut) : null);

// Total hours only when BOTH official timestamps are approved.
$total = attendance_total($approvedTimeIn, $approvedTimeOut);
$totalMinutes = $total['minutes'];
$totalHours = $total['label'];

$canTimeIn = $state === 'NOT_TIMED_IN';
$canTimeOut = $state === 'TIMED_IN';
$canCancel = $state === 'PENDING_TIME_IN' || $state === 'PENDING_TIME_OUT';

echo json_encode([
    'id' => (int)$record['id'],
    'staff_id' => (int)$record['staff_id'],
    'date' => $record['attendance_date'],
    'attendance_status' => $state,
    'status' => attendance_status_label($state),
    'requested_time_in' => $requestedTimeIn,
    'approved_time_in' => $approvedTimeIn,
    'requested_time_out' => $requestedTimeOut,
    'approved_time_out' => $approvedTimeOut,
    'time_in' => $approvedTimeIn,
    'time_out' => $approvedTimeOut,
    'time_in_label' => $timeInLabel,
    'time_out_label' => $timeOutLabel,
    'time_in_status' => $record['time_in_status'],
    'time_out_status' => $record['time_out_status'],
    'total_minutes' => $totalMinutes,
    'total_hours' => $totalHours,
    'pending_time_in' => $state === 'PENDING_TIME_IN',
    'pending_time_out' => $state === 'PENDING_TIME_OUT',
    'can_time_in' => $canTimeIn,
    'can_time_out' => $canTimeOut,
    'can_cancel' => $canCancel,
    'correction_status' => $record['correction_status'] ?: null,
    'time_out_source' => $record['time_out_source'],
    'time_out_recorded_by' => $record['time_out_recorded_by'] ? (int)$record['time_out_recorded_by'] : null,
    'time_in_reviewed_by' => $record['time_in_reviewer'] ?: null,
    'time_out_reviewed_by' => $record['time_out_reviewer'] ?: null,
    'time_out_reason' => $record['time_out_reason'],
]);