<?php
header('Content-Type: application/json');
require_once __DIR__ . '/../config/cors.php';

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }
if ($_SERVER['REQUEST_METHOD'] !== 'POST') { http_response_code(405); echo json_encode(['error' => 'Method not allowed']); exit; }

require_once __DIR__ . '/../middleware/auth.php';
$user = requirePermission('attendance', ['Admin', 'Super Admin']);

require_once __DIR__ . '/../config/database.php';

$input = json_decode(file_get_contents('php://input'), true) ?: [];
$correctionId = (int)($input['correction_id'] ?? 0);
$status = trim((string)($input['status'] ?? ''));
$reason = trim((string)($input['reason'] ?? ''));
$attendanceId = (int)($input['attendance_id'] ?? 0);

if (!$correctionId || !$status || !in_array($status, ['Approved', 'Rejected'], true)) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid request.']);
    exit;
}

$stmt = $pdo->prepare('SELECT * FROM attendance_corrections WHERE id = ?');
$stmt->execute([$correctionId]);
$correction = $stmt->fetch();
if (!$correction) {
    http_response_code(404);
    echo json_encode(['error' => 'Correction request not found.']);
    exit;
}

if ((int)$correction['staff_id'] === (int)$user['user_id']) {
    http_response_code(403);
    echo json_encode(['error' => 'You cannot approve or reject your own correction request.']);
    exit;
}

if ($correction['status'] !== 'Pending') {
    http_response_code(409);
    echo json_encode(['error' => 'This correction request has already been reviewed.']);
    exit;
}

$previousStatus = $correction['status'];

try {
    $pdo->beginTransaction();

    $stmt = $pdo->prepare('UPDATE attendance_corrections SET status = ?, reviewed_by = ?, reviewed_at = NOW() WHERE id = ?');
    $stmt->execute([$status, (int)$user['user_id'], $correctionId]);

    $logStmt = $pdo->prepare('INSERT INTO activity_logs (user_id, action, target_type, target_id, detail, previous_value, new_value) VALUES (?, ?, ?, ?, ?, ?, ?)');
    $logDetail = $status === 'Approved' ? 'Approved correction request' : 'Rejected correction request';
    $logStmt->execute([
        (int)$user['user_id'],
        'attendance_correction_' . strtolower($status),
        'attendance_correction',
        $correctionId,
        $logDetail,
        $previousStatus,
        $status
    ]);

    $pdo->commit();

    echo json_encode(['success' => true]);
} catch (Exception $e) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    http_response_code(500);
    echo json_encode(['error' => 'Unable to process correction review. Please try again.']);
    exit;
}
