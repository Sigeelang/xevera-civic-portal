<?php
header('Content-Type: application/json');
require_once __DIR__ . '/../config/cors.php';

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }
if ($_SERVER['REQUEST_METHOD'] !== 'POST') { http_response_code(405); echo json_encode(['error' => 'Method not allowed']); exit; }

require_once __DIR__ . '/../middleware/auth.php';
$user = requirePermission('attendance', ['Admin', 'Super Admin']);

require_once __DIR__ . '/../config/database.php';

$input = json_decode(file_get_contents('php://input'), true) ?: [];
$action = trim((string)($input['action'] ?? ''));
$type = trim((string)($input['type'] ?? ''));
$attendanceId = (int)($input['attendance_id'] ?? 0);
$reason = trim((string)($input['reason'] ?? ''));

if (!in_array($action, ['approve', 'reject'], true) || !in_array($type, ['time_in', 'time_out'], true) || !$attendanceId) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid request.']);
    exit;
}

if ($action === 'reject' && $reason === '') {
    http_response_code(400);
    echo json_encode(['error' => 'A rejection reason is required.']);
    exit;
}

try {
    $pdo->beginTransaction();

    $stmt = $pdo->prepare('SELECT a.*, u.name AS staff_name FROM attendance a JOIN users u ON a.staff_id = u.id WHERE a.id = ? FOR UPDATE');
    $stmt->execute([$attendanceId]);
    $record = $stmt->fetch();
    if (!$record) {
        $pdo->rollBack();
        http_response_code(404);
        echo json_encode(['error' => 'Attendance record not found.']);
        exit;
    }

    $staffId = (int)$record['staff_id'];
    $actorId = (int)$user['user_id'];

    if ($staffId === $actorId) {
        $pdo->rollBack();
        http_response_code(403);
        echo json_encode(['error' => 'You cannot approve or reject your own attendance request.']);
        exit;
    }

    $now = date('Y-m-d H:i:s');

    if ($type === 'time_in') {
        if ($record['time_in_status'] !== 'Pending') {
            $pdo->rollBack();
            http_response_code(409);
            echo json_encode(['error' => 'This time in request has already been reviewed.']);
            exit;
        }

        if ($action === 'approve') {
            $stmt = $pdo->prepare('UPDATE attendance SET time_in_status = "Approved", time_in_approved_by = ?, time_in_approved_at = ?, status = "Present" WHERE id = ?');
            $stmt->execute([$actorId, $now, $attendanceId]);
            $logAction = 'time_in_approved';
            $logDetail = 'Approved time in request';
            $notifType = 'attendance_time_in_approved';
            $notifMsg = 'Your time in request at ' . date('g:i A', strtotime($record['time_in'])) . ' has been approved by ' . ($user['name'] ?? 'Admin') . '.';
        } else {
            $stmt = $pdo->prepare('UPDATE attendance SET time_in_status = "Rejected", time_in_rejected_by = ?, time_in_rejected_at = ?, time_in_rejection_reason = ?, status = "Not Started" WHERE id = ?');
            $stmt->execute([$actorId, $now, $reason, $attendanceId]);
            $logAction = 'time_in_rejected';
            $logDetail = 'Rejected time in request';
            $notifType = 'attendance_time_in_rejected';
            $notifMsg = 'Your time in request was rejected by ' . ($user['name'] ?? 'Admin') . ': ' . $reason;
        }
    } else {
        if ($record['time_out_status'] !== 'Pending') {
            $pdo->rollBack();
            http_response_code(409);
            echo json_encode(['error' => 'This time out request has already been reviewed.']);
            exit;
        }

        if ($action === 'approve') {
            $totalMinutes = 0;
            if ($record['time_in'] && $record['time_out']) {
                $tIn = new DateTime($record['time_in']);
                $tOut = new DateTime($record['time_out']);
                $totalMinutes = $tIn->diff($tOut)->days * 1440 + $tIn->diff($tOut)->h * 60 + $tIn->diff($tOut)->i;
            }
            $stmt = $pdo->prepare('UPDATE attendance SET time_out_status = "Approved", time_out_approved_by = ?, time_out_approved_at = ?, total_minutes = ?, status = "Completed" WHERE id = ?');
            $stmt->execute([$actorId, $now, $totalMinutes, $attendanceId]);
            $logAction = 'time_out_approved';
            $logDetail = 'Approved time out request';
            $notifType = 'attendance_time_out_approved';
            $notifMsg = 'Your time out request at ' . date('g:i A', strtotime($record['time_out'])) . ' has been approved by ' . ($user['name'] ?? 'Admin') . '.';
        } else {
            $stmt = $pdo->prepare('UPDATE attendance SET time_out_status = "Rejected", time_out_rejected_by = ?, time_out_rejected_at = ?, time_out_rejection_reason = ?, status = "Present" WHERE id = ?');
            $stmt->execute([$actorId, $now, $reason, $attendanceId]);
            $logAction = 'time_out_rejected';
            $logDetail = 'Rejected time out request';
            $notifType = 'attendance_time_out_rejected';
            $notifMsg = 'Your time out request was rejected by ' . ($user['name'] ?? 'Admin') . ': ' . $reason;
        }
    }

    $logStmt = $pdo->prepare('INSERT INTO activity_logs (user_id, action, target_type, target_id, detail, previous_value, new_value, reason, ip_address) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
    $logStmt->execute([$actorId, $logAction, 'attendance', $attendanceId, $logDetail, 'Pending', $action === 'approve' ? 'Approved' : 'Rejected', $reason ?: null, $_SERVER['REMOTE_ADDR'] ?? null]);

    $notifStmt = $pdo->prepare('INSERT INTO notifications (user_id, report_id, type, message, is_read) VALUES (?, NULL, ?, ?, 0)');
    $notifStmt->execute([$staffId, $notifType, mb_substr($notifMsg, 0, 500)]);

    $pdo->commit();

    echo json_encode([
        'success' => true,
        'message' => ucfirst($action) . 'd ' . str_replace('_', ' ', $type) . ' successfully.',
        'status' => $type === 'time_in' ? ($action === 'approve' ? 'Present' : 'Absent') : ($action === 'approve' ? 'Completed' : 'Present'),
    ]);
} catch (Exception $e) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    http_response_code(500);
    echo json_encode(['error' => 'Unable to process request. Please try again.']);
    exit;
}