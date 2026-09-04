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

$attendanceId = (int)($_GET['id'] ?? 0);
if (!$attendanceId) {
    http_response_code(400);
    echo json_encode(['error' => 'Attendance ID is required.']);
    exit;
}

$uid = (int)$user['user_id'];
$isManager = in_array($role, ['Admin', 'Super Admin'], true);

$stmt = $pdo->prepare('SELECT a.*, u.name AS staff_name, u.username AS staff_username FROM attendance a JOIN users u ON a.staff_id = u.id WHERE a.id = ?');
$stmt->execute([$attendanceId]);
$record = $stmt->fetch();

if (!$record) {
    http_response_code(404);
    echo json_encode(['error' => 'Attendance record not found.']);
    exit;
}

if (!$isManager && (int)$record['staff_id'] !== $uid) {
    http_response_code(403);
    echo json_encode(['error' => 'You can only view your own attendance records.']);
    exit;
}

function resolveName(PDO $pdo, ?int $userId): ?string {
    if ($userId === null) return null;
    $stmt = $pdo->prepare('SELECT name FROM users WHERE id = ?');
    $stmt->execute([$userId]);
    $n = $stmt->fetchColumn();
    return $n ?: null;
}

$approvedByName = resolveName($pdo, $record['time_in_approved_by']);
$approvedOutName = resolveName($pdo, $record['time_out_approved_by']);

$timeline = [];
if ($record['time_in']) {
    $timeline[] = ['time' => $record['time_in'], 'action' => 'TIME_IN_REQUESTED', 'detail' => 'Time In Requested', 'by' => $record['staff_name']];
}
if ($record['time_in_status'] === 'Approved' && $record['time_in_approved_at']) {
    $timeline[] = ['time' => $record['time_in_approved_at'], 'action' => 'TIME_IN_APPROVED', 'detail' => 'Time In Approved', 'by' => $approvedByName ?? 'Admin'];
} elseif ($record['time_in_status'] === 'Rejected' && $record['time_in_rejected_at']) {
    $timeline[] = ['time' => $record['time_in_rejected_at'], 'action' => 'TIME_IN_REJECTED', 'detail' => 'Time In Rejected', 'by' => resolveName($pdo, $record['time_in_rejected_by']) ?? 'Admin', 'reason' => $record['time_in_rejection_reason']];
}
if ($record['time_out']) {
    $timeline[] = ['time' => $record['time_out'], 'action' => 'TIME_OUT_REQUESTED', 'detail' => 'Time Out Requested', 'by' => $record['staff_name']];
}
if ($record['time_out_status'] === 'Approved' && $record['time_out_approved_at']) {
    $timeline[] = ['time' => $record['time_out_approved_at'], 'action' => 'TIME_OUT_APPROVED', 'detail' => 'Time Out Approved', 'by' => $approvedOutName ?? 'Admin'];
} elseif ($record['time_out_status'] === 'Rejected' && $record['time_out_rejected_at']) {
    $timeline[] = ['time' => $record['time_out_rejected_at'], 'action' => 'TIME_OUT_REJECTED', 'detail' => 'Time Out Rejected', 'by' => resolveName($pdo, $record['time_out_rejected_by']) ?? 'Admin', 'reason' => $record['time_out_rejection_reason']];
}
if ($record['time_out_source'] && $record['time_out_recorded_by']) {
    $directByName = resolveName($pdo, $record['time_out_recorded_by']);
    $timeline[] = ['time' => $record['time_out'], 'action' => 'ADMIN_DIRECT_TIME_OUT', 'detail' => 'Time Out Recorded by Admin', 'by' => $directByName ?? 'Admin', 'reason' => $record['time_out_reason']];
}

$logStmt = $pdo->prepare('SELECT al.id, al.action, al.detail, al.created_at, u.name AS actor FROM activity_logs al LEFT JOIN users u ON al.user_id = u.id WHERE al.target_type = "attendance" AND al.target_id = ? ORDER BY al.created_at ASC');
$logStmt->execute([$attendanceId]);
$auditLog = $logStmt->fetchAll();

$state = attendance_state($record);
$tinApproved = ($record['time_in_status'] ?? null) === 'Approved' && !empty($record['time_in']);
$toutApproved = ($record['time_out_status'] ?? null) === 'Approved' && !empty($record['time_out']);
$approvedTimeIn = $tinApproved ? $record['time_in'] : null;
$approvedTimeOut = $toutApproved ? $record['time_out'] : null;
$total = attendance_total($approvedTimeIn, $approvedTimeOut);

echo json_encode([
    'id' => (int)$record['id'],
    'staff_id' => (int)$record['staff_id'],
    'staff_name' => $record['staff_name'],
    'staff_username' => $record['staff_username'],
    'date' => $record['attendance_date'],
    'attendance_status' => $state,
    'time_in' => $record['time_in'],
    'time_out' => $record['time_out'],
    'status' => attendance_status_label($state),
    'time_in_status' => $record['time_in_status'],
    'time_out_status' => $record['time_out_status'],
    'total_minutes' => $total['minutes'],
    'total_hours' => $total['label'],
    'approved_by' => $approvedByName,
    'approved_out_by' => $approvedOutName,
    'time_out_reason' => $record['time_out_reason'],
    'timeline' => $timeline,
    'audit_log' => array_map(function ($l) {
        return [
            'time' => $l['created_at'],
            'action' => $l['action'],
            'detail' => $l['detail'],
            'by' => $l['actor'] ?? 'System',
        ];
    }, $auditLog),
]);