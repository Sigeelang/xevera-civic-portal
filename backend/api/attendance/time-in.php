<?php
header('Content-Type: application/json');
require_once __DIR__ . '/../config/cors.php';

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }
if ($_SERVER['REQUEST_METHOD'] !== 'POST') { http_response_code(405); echo json_encode(['error' => 'Method not allowed']); exit; }

require_once __DIR__ . '/../middleware/auth.php';
$user = requireAuth();
$role = $user['role'] ?? '';

if ($role !== 'Staff') {
    http_response_code(403);
    echo json_encode(['error' => 'Forbidden. Staff access required.']);
    exit;
}

require_once __DIR__ . '/../config/database.php';

$uid = (int)$user['user_id'];
$today = date('Y-m-d');
$now = date('Y-m-d H:i:s');

try {
    $pdo->beginTransaction();

    $stmt = $pdo->prepare('SELECT * FROM attendance WHERE staff_id = ? AND attendance_date = ? FOR UPDATE');
    $stmt->execute([$uid, $today]);
    $existing = $stmt->fetch();

    if ($existing) {
        if ($existing['time_in_status'] === 'Approved' && !empty($existing['time_in'])) {
            $pdo->rollBack();
            http_response_code(409);
            echo json_encode(['error' => 'You have already timed in today.']);
            exit;
        }
        if ($existing['time_in_status'] === 'Pending') {
            $pdo->rollBack();
            http_response_code(409);
            echo json_encode(['error' => 'You already have a pending time in request.']);
            exit;
        }
        // Rejected/NULL status: allow a fresh time in request.
    }

    if (!$existing) {
        $stmt = $pdo->prepare('INSERT INTO attendance (staff_id, attendance_date, time_in, time_in_source, time_in_status, status) VALUES (?, ?, ?, ?, ?, ?)');
        $stmt->execute([$uid, $today, $now, 'STAFF', 'Pending', 'Pending Time In']);
    } else {
        $stmt = $pdo->prepare('UPDATE attendance SET time_in = ?, time_in_source = ?, time_in_status = ?, time_in_approved_by = NULL, time_in_approved_at = NULL, time_in_rejected_by = NULL, time_in_rejected_at = NULL, time_in_rejection_reason = NULL, status = ? WHERE id = ?');
        $stmt->execute([$now, 'STAFF', 'Pending', 'Pending Time In', (int)$existing['id']]);
    }

    $logStmt = $pdo->prepare('INSERT INTO activity_logs (user_id, action, target_type, target_id, detail, previous_value, new_value, reason, ip_address) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
    $logStmt->execute([$uid, 'time_in_requested', 'attendance', $uid, 'Staff requested time in', 'No time in', $now, 'Time in request pending approval', $_SERVER['REMOTE_ADDR'] ?? null]);

    $notifStmt = $pdo->prepare('SELECT id FROM users WHERE role IN ("Admin", "Super Admin") AND status = "Active"');
    $notifStmt->execute();
    $admins = $notifStmt->fetchAll();
    foreach ($admins as $admin) {
        $notifInsert = $pdo->prepare('INSERT INTO notifications (user_id, report_id, type, message, is_read) VALUES (?, NULL, ?, ?, 0)');
        $notifInsert->execute([$admin['id'], 'attendance_time_in_request', 'Time in request from ' . ($user['name'] ?? 'Staff') . ' at ' . date('g:i A', strtotime($now))]);
    }

    $pdo->commit();

    echo json_encode(['success' => true, 'message' => 'Time in request submitted. Waiting for Admin approval.', 'time_in' => $now, 'status' => 'Pending Time In']);
} catch (Exception $e) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    http_response_code(500);
    echo json_encode(['error' => 'Unable to record time in. Please try again.']);
    exit;
}
