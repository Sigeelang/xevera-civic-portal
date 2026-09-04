<?php
header('Content-Type: application/json');
require_once __DIR__ . '/../config/cors.php';

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }
if ($_SERVER['REQUEST_METHOD'] !== 'POST') { http_response_code(405); echo json_encode(['error' => 'Method not allowed']); exit; }

require_once __DIR__ . '/../middleware/auth.php';
$user = requireAuth();
$role = $user['role'] ?? '';
if (!in_array($role, ['Staff', 'Admin', 'Super Admin'], true)) {
    http_response_code(403);
    echo json_encode(['error' => 'Forbidden. Staff access required.']);
    exit;
}

require_once __DIR__ . '/../config/database.php';

$uid = (int)$user['user_id'];
$input = json_decode(file_get_contents('php://input'), true) ?: [];
$targetStaffId = isset($input['staff_id']) ? (int)$input['staff_id'] : $uid;
$reason = trim((string)($input['reason'] ?? ''));

if ($targetStaffId !== $uid && !in_array($role, ['Admin', 'Super Admin'], true)) {
    http_response_code(403);
    echo json_encode(['error' => 'Forbidden. You can only record your own time out.']);
    exit;
}

if ($targetStaffId !== $uid && empty($reason)) {
    http_response_code(400);
    echo json_encode(['error' => 'Reason is required when recording time out for another staff member.']);
    exit;
}

$today = date('Y-m-d');
$now = date('Y-m-d H:i:s');

try {
    $pdo->beginTransaction();

    $stmt = $pdo->prepare('SELECT * FROM attendance WHERE staff_id = ? AND attendance_date = ? FOR UPDATE');
    $stmt->execute([$targetStaffId, $today]);
    $existing = $stmt->fetch();

    if (!$existing || empty($existing['time_in']) || $existing['time_in_status'] !== 'Approved') {
        $pdo->rollBack();
        http_response_code(409);
        echo json_encode(['error' => 'Your time in must be approved before you can time out.']);
        exit;
    }

    if ($existing['time_out_status'] === 'Approved' && !empty($existing['time_out'])) {
        $pdo->rollBack();
        http_response_code(409);
        echo json_encode(['error' => 'You have already timed out today.']);
        exit;
    }

    if ($existing['time_out_status'] === 'Pending') {
        $pdo->rollBack();
        http_response_code(409);
        echo json_encode(['error' => 'You already have a pending time out request.']);
        exit;
    }

    $isAdminAction = $targetStaffId !== $uid;

    if ($isAdminAction) {
        $source = strtoupper(str_replace(' ', '_', $role));
        $recordedBy = $uid;
        $status = 'Completed';
        $timeOutStatus = 'Approved';
        $timeOutReason = $reason ?: null;
        $logDetail = $role . ' recorded time out for staff';
        $logAction = 'admin_direct_time_out';
        $notifType = 'attendance_direct_timeout';
        $notifMsg = 'Admin recorded time out for you at ' . date('g:i A', strtotime($now)) . ($reason ? ' (' . $reason . ')' : '');

        $tIn = new DateTime($existing['time_in']);
        $tOut = new DateTime($now);
        $diff = $tIn->diff($tOut);
        $totalMinutes = $diff->days * 1440 + $diff->h * 60 + $diff->i;
    } else {
        $source = 'STAFF';
        $recordedBy = null;
        $status = 'Pending Time Out';
        $timeOutStatus = 'Pending';
        $timeOutReason = $reason ?: null;
        $logDetail = 'Staff requested time out';
        $logAction = 'time_out_requested';
        $notifType = 'attendance_time_out_request';
        $notifMsg = 'Time out request from ' . ($user['name'] ?? 'Staff') . ' at ' . date('g:i A', strtotime($now));
        // Total hours are calculated only once the time out is approved.
        $totalMinutes = null;
    }

    $stmt = $pdo->prepare('UPDATE attendance SET time_out = ?, total_minutes = ?, status = ?, time_out_status = ?, time_out_source = ?, time_out_recorded_by = ?, time_out_reason = ?, time_out_approved_by = NULL, time_out_approved_at = NULL, time_out_rejected_by = NULL, time_out_rejected_at = NULL, time_out_rejection_reason = NULL WHERE id = ?');
    $stmt->execute([$now, $totalMinutes, $status, $timeOutStatus, $source, $recordedBy, $timeOutReason, (int)$existing['id']]);

    $logStmt = $pdo->prepare('INSERT INTO activity_logs (user_id, action, target_type, target_id, detail, previous_value, new_value, reason, ip_address) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
    $logStmt->execute([$uid, $logAction, 'attendance', $existing['id'], $logDetail, 'No time out', $now, $reason ?: ($isAdminAction ? 'Direct time out recorded' : 'Time out request pending'), $_SERVER['REMOTE_ADDR'] ?? null]);

    if (!$isAdminAction) {
        $notifStmt = $pdo->prepare('SELECT id FROM users WHERE role IN ("Admin", "Super Admin") AND status = "Active"');
        $notifStmt->execute();
        $admins = $notifStmt->fetchAll();
        foreach ($admins as $admin) {
            $notifInsert = $pdo->prepare('INSERT INTO notifications (user_id, report_id, type, message, is_read) VALUES (?, NULL, ?, ?, 0)');
            $notifInsert->execute([$admin['id'], $notifType, $notifMsg]);
        }
    } else {
        $notifInsert = $pdo->prepare('INSERT INTO notifications (user_id, report_id, type, message, is_read) VALUES (?, NULL, ?, ?, 0)');
        $notifInsert->execute([$targetStaffId, $notifType, $notifMsg]);
    }

    $pdo->commit();

    $response = ['success' => true, 'message' => $isAdminAction ? 'Time out recorded successfully.' : 'Time out request submitted. Waiting for Admin approval.', 'time_out' => $now, 'total_minutes' => $totalMinutes, 'source' => $source, 'status' => $status];
    echo json_encode($response);
} catch (Exception $e) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    http_response_code(500);
    echo json_encode(['error' => 'Unable to record time out. Please try again.']);
    exit;
}
