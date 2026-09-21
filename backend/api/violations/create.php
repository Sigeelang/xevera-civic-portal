<?php
header('Content-Type: application/json');
require_once __DIR__ . '/../config/cors.php';
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../middleware/auth.php';

$user = requireRole(['Admin', 'Super Admin']);
$input = json_decode(file_get_contents('php://input'), true);

$reportId = (int)($input['report_id'] ?? 0);
$residentId = (int)($input['resident_id'] ?? 0);
$violationType = $input['violation_type'] ?? '';
$severity = $input['severity'] ?? 'Minor';
$description = trim($input['description'] ?? ($input['reason'] ?? ''));
$evidence = trim($input['evidence'] ?? '');

$allowedTypes = ['False Information','Fake Report','Spam Report','Duplicate Report','Abusive Submission','Not a Violation'];
$allowedSeverities = ['Minor','Major','Serious','Critical'];

// Confirming directly from a flagged report: resolve the reporter as the violator
if (!$residentId && $reportId) {
    $repStmt = $pdo->prepare("SELECT reporter_user_id FROM reports WHERE id = ?");
    $repStmt->execute([$reportId]);
    $repRow = $repStmt->fetch();
    if (!$repRow || !(int)($repRow['reporter_user_id'] ?? 0)) {
        http_response_code(404);
        echo json_encode(['error' => 'Report not found or has no reporter.']);
        exit;
    }
    $residentId = (int)$repRow['reporter_user_id'];
}

if (!$residentId || !in_array($violationType, $allowedTypes, true) || !in_array($severity, $allowedSeverities, true)) {
    http_response_code(400);
    echo json_encode(['error' => 'resident_id, valid violation_type, and severity required.']);
    exit;
}

// Get penalty config
$cfgStmt = $pdo->prepare("SELECT `value` FROM system_settings WHERE `key` = ?");
$cfgStmt->execute(['violation_penalty_config']);
$cfgRow = $cfgStmt->fetch();
$penaltyConfig = json_decode($cfgRow['value'] ?? '{}', true) ?: [];
$penalty = $penaltyConfig[$severity] ?? [];

// Determine penalty based on severity and prior violations
$penaltyType = null;
$penaltyAmount = null;
$suspensionDays = null;

if ($severity === 'Critical') {
    $penaltyType = 'Long Suspension';
    $suspensionDays = $penalty['suspension_days'] ?? 30;
} elseif ($severity === 'Serious') {
    $penaltyType = 'Short Suspension';
    $suspensionDays = $penalty['suspension_days'] ?? 7;
    $penaltyAmount = $penalty['fine'] ?? 500;
} elseif ($severity === 'Major') {
    $penaltyType = 'Reporting Restriction';
    $penaltyAmount = $penalty['fine'] ?? 250;
} else {
    $penaltyType = 'Warning';
    $penaltyAmount = $penalty['fine'] ?? 100;
}

// No monetary fines: penalties are Warning, Reporting Restriction, or Suspension only
$penaltyAmount = 0;

// Confirmations made directly from a flagged report land in Confirmed;
// standalone creations stay Pending Review
$initialStatus = $reportId ? 'Confirmed' : 'Pending Review';

// Insert violation
$stmt = $pdo->prepare("INSERT INTO violations (resident_id, report_id, violation_type, severity, description, evidence, status, penalty_type, penalty_amount, suspension_days, issued_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
$stmt->execute([$residentId, $reportId ?: null, $violationType, $severity, $description, $evidence, $initialStatus, $penaltyType, $penaltyAmount, $suspensionDays, (int)$user['user_id']]);
$violationId = $pdo->lastInsertId();

// Report-based confirmations: count the violation, notify the resident,
// and deactivate suspended accounts (mirrors violations/update.php confirm)
if ($reportId) {
    $pdo->prepare("UPDATE users SET violation_count = violation_count + 1 WHERE id = ?")->execute([$residentId]);
    if ($penaltyType === 'Short Suspension' || $penaltyType === 'Long Suspension') {
        $restoreDate = date('Y-m-d H:i:s', time() + ((int)($suspensionDays ?: 7) * 86400));
        $pdo->prepare("UPDATE users SET status = 'Inactive', suspension_until = ? WHERE id = ? AND status = 'Active'")->execute([$restoreDate, $residentId]);
    }
    $pdo->prepare("INSERT INTO notifications (user_id, type, message, report_id) VALUES (?, 'violation_confirmed', ?, ?)")->execute([$residentId, "Your report has been reviewed. Violation confirmed: $violationType ($severity). Penalty: $penaltyType.", $reportId]);
}

// Log to violation_history
$histStmt = $pdo->prepare("INSERT INTO violation_history (violation_id, action, new_value, note, acted_by) VALUES (?, 'created', ?, ?, ?)");
$histStmt->execute([$violationId, $severity, "Violation created: $violationType ($severity)", (int)$user['user_id']]);

// Log to activity_logs
$logStmt = $pdo->prepare("INSERT INTO activity_logs (user_id, action, target_type, target_id, detail) VALUES (?, 'create_violation', 'violation', ?, ?)");
$logStmt->execute([(int)$user['user_id'], $violationId, "Violation #$violationId created for resident #$residentId: $violationType"]);

// Notify other admins
$notifStmt = $pdo->prepare("SELECT id FROM users WHERE role IN ('Admin','Super Admin') AND id != ?");
$notifStmt->execute([(int)$user['user_id']]);
$admins = $notifStmt->fetchAll();
foreach ($admins as $admin) {
    $nStmt = $pdo->prepare("INSERT INTO notifications (user_id, type, message, report_id) VALUES (?, 'violation_created', ?, ?)");
    $nStmt->execute([$admin['id'], "New $severity violation: $violationType (Resident #$residentId)", $reportId ?: null]);
}

echo json_encode(['message' => 'Violation created.', 'id' => (int)$violationId]);
