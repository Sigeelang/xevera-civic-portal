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

$input = json_decode(file_get_contents('php://input'), true) ?: [];
$type = trim((string)($input['type'] ?? ''));
if (!in_array($type, ['time_in', 'time_out'], true)) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid request type.']);
    exit;
}

$uid = (int)$user['user_id'];
$today = date('Y-m-d');
$now = date('Y-m-d H:i:s');

try {
    $pdo->beginTransaction();

    $stmt = $pdo->prepare('SELECT * FROM attendance WHERE staff_id = ? AND attendance_date = ? FOR UPDATE');
    $stmt->execute([$uid, $today]);
    $existing = $stmt->fetch();

    if (!$existing) {
        $pdo->rollBack();
        http_response_code(404);
        echo json_encode(['error' => 'No attendance record found for today.']);
        exit;
    }

    if ($type === 'time_in') {
        if ($existing['time_in_status'] !== 'Pending') {
            $pdo->rollBack();
            http_response_code(409);
            echo json_encode(['error' => 'There is no pending time in request to cancel.']);
            exit;
        }
        $stmt = $pdo->prepare('UPDATE attendance SET time_in = NULL, time_in_source = NULL, time_in_status = NULL, time_in_approved_by = NULL, time_in_approved_at = NULL, time_in_rejected_by = NULL, time_in_rejected_at = NULL, time_in_rejection_reason = NULL, status = "Not Started" WHERE id = ?');
        $stmt->execute([(int)$existing['id']]);
        $logAction = 'time_in_cancelled';
        $logDetail = 'Cancelled pending time in request';
    } else {
        if ($existing['time_out_status'] !== 'Pending') {
            $pdo->rollBack();
            http_response_code(409);
            echo json_encode(['error' => 'There is no pending time out request to cancel.']);
            exit;
        }
        $stmt = $pdo->prepare('UPDATE attendance SET time_out = NULL, time_out_source = NULL, time_out_status = NULL, total_minutes = NULL, time_out_recorded_by = NULL, time_out_reason = NULL, time_out_approved_by = NULL, time_out_approved_at = NULL, time_out_rejected_by = NULL, time_out_rejected_at = NULL, time_out_rejection_reason = NULL, status = "Present" WHERE id = ?');
        $stmt->execute([(int)$existing['id']]);
        $logAction = 'time_out_cancelled';
        $logDetail = 'Cancelled pending time out request';
    }

    $logStmt = $pdo->prepare('INSERT INTO activity_logs (user_id, action, target_type, target_id, detail, previous_value, new_value, ip_address) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
    $logStmt->execute([$uid, $logAction, 'attendance', (int)$existing['id'], $logDetail, 'Pending', 'Cancelled', $_SERVER['REMOTE_ADDR'] ?? null]);

    $pdo->commit();

    echo json_encode(['success' => true, 'message' => 'Request cancelled successfully.']);
} catch (Exception $e) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    http_response_code(500);
    echo json_encode(['error' => 'Unable to cancel request. Please try again.']);
    exit;
}