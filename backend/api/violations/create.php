<?php
header('Content-Type: application/json');
require_once __DIR__ . '/../config/cors.php';
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../middleware/auth.php';
require_once __DIR__ . '/penalty_schedule.php';

$user = requirePermission('violations', ['Admin', 'Super Admin']);
$input = json_decode(file_get_contents('php://input'), true);

$reportId = (int)($input['report_id'] ?? 0);
$residentId = (int)($input['resident_id'] ?? 0);
$violationType = $input['violation_type'] ?? '';
$severity = $input['severity'] ?? 'Minor';
$description = trim($input['description'] ?? ($input['reason'] ?? ''));
$evidence = trim($input['evidence'] ?? '');
$penaltyKey = trim($input['penalty_key'] ?? '');

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

// Determine penalty: explicit admin-chosen penalty_key wins, otherwise
// fall back to the legacy severity auto-map. No monetary fines, and every
// penalty/restriction starts at 8:00 AM Asia/Manila.
$sched = xevera_penalty_schedule($penaltyKey !== '' ? $penaltyKey : null, $severity, $penalty);
$penaltyType = $sched['penalty_type'];
$penaltyAmount = 0;
$suspensionDays = ($sched['days'] !== null && (int)$sched['days'] > 0) ? (int)$sched['days'] : null;
$penaltyStart = $sched['start'];
$penaltyEnd = $sched['end'];

// Confirmations made directly from a flagged report land in Confirmed;
// standalone creations stay Pending Review
$initialStatus = $reportId ? 'Confirmed' : 'Pending Review';

// Insert violation (penalty schedule columns are optional until the
// penalty-schedule migration has run on the database)
$hasScheduleCols = false;
try {
    $hasScheduleCols = (bool)$pdo->query("SHOW COLUMNS FROM violations LIKE 'penalty_start_at'")->fetch();
} catch (Throwable $e) { $hasScheduleCols = false; }
if ($hasScheduleCols) {
    $stmt = $pdo->prepare("INSERT INTO violations (resident_id, report_id, violation_type, severity, description, evidence, status, penalty_type, penalty_amount, suspension_days, restriction_until, penalty_start_at, penalty_end_at, issued_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
    $stmt->execute([$residentId, $reportId ?: null, $violationType, $severity, $description, $evidence, $initialStatus, $penaltyType, $penaltyAmount, $suspensionDays, $penaltyEnd, $penaltyStart, $penaltyEnd, (int)$user['user_id']]);
} else {
    $stmt = $pdo->prepare("INSERT INTO violations (resident_id, report_id, violation_type, severity, description, evidence, status, penalty_type, penalty_amount, suspension_days, restriction_until, issued_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
    $stmt->execute([$residentId, $reportId ?: null, $violationType, $severity, $description, $evidence, $initialStatus, $penaltyType, $penaltyAmount, $suspensionDays, $penaltyEnd, (int)$user['user_id']]);
}
$violationId = $pdo->lastInsertId();

// Report-based confirmations: count the violation, notify the resident,
// and deactivate suspended accounts (mirrors violations/update.php confirm)
if ($reportId) {
    $pdo->prepare("UPDATE users SET violation_count = violation_count + 1 WHERE id = ?")->execute([$residentId]);
    if ($penaltyType === 'Short Suspension' || $penaltyType === 'Long Suspension') {
        $pdo->prepare("UPDATE users SET status = 'Inactive', suspension_until = ? WHERE id = ? AND status = 'Active'")->execute([$penaltyEnd, $residentId]);
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

echo json_encode([
    'message' => 'Violation created.',
    'id' => (int)$violationId,
    'penalty' => [
        'type' => $penaltyType,
        'days' => $sched['days'],
        'start' => $penaltyStart,
        'end' => $penaltyEnd,
        'fee' => 0,
    ],
]);
