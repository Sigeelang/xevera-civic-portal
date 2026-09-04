<?php
header('Content-Type: application/json');
require_once __DIR__ . '/../config/cors.php';

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }

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
$isManager = in_array($role, ['Admin', 'Super Admin'], true);
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    if ($isManager && isset($_GET['staff_id'])) {
        $stmt = $pdo->prepare('SELECT * FROM attendance_corrections WHERE staff_id = ? ORDER BY created_at DESC');
        $stmt->execute([(int)$_GET['staff_id']]);
    } else {
        $stmt = $pdo->prepare('SELECT * FROM attendance_corrections WHERE staff_id = ? ORDER BY created_at DESC');
        $stmt->execute([$uid]);
    }
    $items = $stmt->fetchAll();
    echo json_encode(['items' => $items]);
    exit;
}

if ($method === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true) ?: [];
    $attendanceId = (int)($input['attendance_id'] ?? 0);
    $reason = trim((string)($input['reason'] ?? ''));
    $requestedTimeIn = trim((string)($input['requested_time_in'] ?? ''));
    $requestedTimeOut = trim((string)($input['requested_time_out'] ?? ''));

    if (!$attendanceId || !$reason) {
        http_response_code(400);
        echo json_encode(['error' => 'Attendance ID and reason are required.']);
        exit;
    }

    if ($requestedTimeIn && !preg_match('/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/', $requestedTimeIn)) {
        http_response_code(400);
        echo json_encode(['error' => 'Invalid requested time in format. Use YYYY-MM-DD HH:MM:SS.']);
        exit;
    }

    if ($requestedTimeOut && !preg_match('/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/', $requestedTimeOut)) {
        http_response_code(400);
        echo json_encode(['error' => 'Invalid requested time out format. Use YYYY-MM-DD HH:MM:SS.']);
        exit;
    }

    $stmt = $pdo->prepare('SELECT * FROM attendance WHERE id = ? AND staff_id = ?');
    $stmt->execute([$attendanceId, $uid]);
    $attendance = $stmt->fetch();
    if (!$attendance) {
        http_response_code(404);
        echo json_encode(['error' => 'Attendance record not found.']);
        exit;
    }

    $stmt = $pdo->prepare('INSERT INTO attendance_corrections (attendance_id, staff_id, requested_time_in, requested_time_out, reason) VALUES (?, ?, ?, ?, ?)');
    $stmt->execute([$attendanceId, $uid, $requestedTimeIn ?: null, $requestedTimeOut ?: null, $reason]);
    $correctionId = (int)$pdo->lastInsertId();

    $logStmt = $pdo->prepare('INSERT INTO activity_logs (user_id, action, target_type, target_id, detail, previous_value, new_value, reason, ip_address) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
    $logStmt->execute([$uid, 'attendance_correction_request', 'attendance', $attendanceId, 'Requested attendance correction', 'Original attendance', 'Correction requested', $reason, $_SERVER['REMOTE_ADDR'] ?? null]);

    echo json_encode(['success' => true, 'correction_id' => $correctionId]);
    exit;
}

