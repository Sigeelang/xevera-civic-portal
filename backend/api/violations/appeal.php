<?php
header('Content-Type: application/json');
require_once __DIR__ . '/../config/cors.php';
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../middleware/auth.php';

$user = requireRole(['Resident']);
$input = json_decode(file_get_contents('php://input'), true);
$violationId = (int)($input['violation_id'] ?? 0);
$appealReason = trim($input['appeal_reason'] ?? '');

if (!$violationId || !$appealReason) {
    http_response_code(400);
    echo json_encode(['error' => 'violation_id and appeal_reason required.']);
    exit;
}

// Verify this violation belongs to the current user
$stmt = $pdo->prepare("SELECT * FROM violations WHERE id = ? AND resident_id = ?");
$stmt->execute([$violationId, (int)$user['user_id']]);
$violation = $stmt->fetch();
if (!$violation) { http_response_code(404); echo json_encode(['error' => 'Violation not found.']); exit; }
if ($violation['status'] !== 'Confirmed') {
    http_response_code(400);
    echo json_encode(['error' => 'Only confirmed violations can be appealed.']);
    exit;
}

$uStmt = $pdo->prepare("UPDATE violations SET status = 'Appealed', appeal_reason = ?, appeal_date = NOW() WHERE id = ?");
$uStmt->execute([$appealReason, $violationId]);

// Log history
$histStmt = $pdo->prepare("INSERT INTO violation_history (violation_id, action, old_value, new_value, note, acted_by) VALUES (?, 'appeal', 'Confirmed', 'Appealed', ?, ?)");
$histStmt->execute([$violationId, "Resident appeal: $appealReason", (int)$user['user_id']]);

// Notify admins (must never fail the saved appeal)
try {
    $adminStmt = $pdo->prepare("SELECT id FROM users WHERE role IN ('Admin','Super Admin')");
    $adminStmt->execute();
    $admins = $adminStmt->fetchAll();
    foreach ($admins as $admin) {
        $nStmt = $pdo->prepare("INSERT INTO notifications (user_id, type, message, report_id) VALUES (?, 'violation_appeal', ?, ?)");
        $nStmt->execute([$admin['id'], "Resident has appealed violation #$violationId: " . mb_substr($appealReason, 0, 100), $violation['report_id']]);
    }
} catch (Throwable $e) { /* appeal already saved */ }

echo json_encode(['message' => 'Appeal submitted.']);
