<?php
header('Content-Type: application/json');
require_once __DIR__ . '/../config/cors.php';
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../middleware/auth.php';

$user = requireRole(['Admin', 'Super Admin']);
$input = json_decode(file_get_contents('php://input'), true);
$id = (int)($input['id'] ?? 0);
$action = $input['action'] ?? '';

if (!$id || !$action) {
    http_response_code(400);
    echo json_encode(['error' => 'id and action required.']);
    exit;
}

// Fetch violation
$stmt = $pdo->prepare("SELECT v.*, u.violation_count FROM violations v JOIN users u ON v.resident_id = u.id WHERE v.id = ?");
$stmt->execute([$id]);
$violation = $stmt->fetch();
if (!$violation) { http_response_code(404); echo json_encode(['error' => 'Violation not found.']); exit; }

$actorId = (int)$user['user_id'];
$oldStatus = $violation['status'];

switch ($action) {
    case 'confirm':
        $newStatus = 'Confirmed';
        $note = trim($input['note'] ?? 'Violation confirmed by admin');
        $penaltyType = $violation['penalty_type'];
        $penaltyAmount = $violation['penalty_amount'];
        $suspensionDays = $violation['suspension_days'];

        // If fine, note it; if suspension, schedule it
        $restrictionUntil = null;
        if ($penaltyType === 'Reporting Restriction') {
            $days = (int)($input['restriction_days'] ?? 1);
            $restrictionUntil = date('Y-m-d H:i:s', time() + ($days * 86400));
        }

        $uStmt = $pdo->prepare("UPDATE violations SET status = ?, penalty_type = ?, penalty_amount = ?, suspension_days = ?, restriction_until = ?, issued_by = ? WHERE id = ?");
        $uStmt->execute([$newStatus, $penaltyType, $penaltyAmount, $suspensionDays, $restrictionUntil, $actorId, $id]);

        // Increment resident violation count
        $pdo->prepare("UPDATE users SET violation_count = violation_count + 1 WHERE id = ?")->execute([$violation['resident_id']]);

        // If suspension, temporarily deactivate user
        if ($penaltyType === 'Short Suspension' || $penaltyType === 'Long Suspension') {
            $restoreDate = date('Y-m-d H:i:s', time() + ($suspensionDays * 86400));
            $pdo->prepare("UPDATE users SET status = 'Inactive', suspension_until = ? WHERE id = ? AND status = 'Active'")->execute([$restoreDate, $violation['resident_id']]);
        }

        // Notify resident
        $msg = "Your report has been reviewed. Violation confirmed: {$violation['violation_type']} ({$violation['severity']}). Penalty: $penaltyType.";
        $pdo->prepare("INSERT INTO notifications (user_id, type, message, report_id) VALUES (?, 'violation_confirmed', ?, ?)")->execute([$violation['resident_id'], $msg, $violation['report_id']]);
        break;

    case 'dismiss':
        $newStatus = 'Dismissed';
        $note = trim($input['note'] ?? 'Violation dismissed');
        $uStmt = $pdo->prepare("UPDATE violations SET status = ?, issued_by = ? WHERE id = ?");
        $uStmt->execute([$newStatus, $actorId, $id]);
        // Notify resident
        $pdo->prepare("INSERT INTO notifications (user_id, type, message, report_id) VALUES (?, 'violation_dismissed', ?, ?)")->execute([$violation['resident_id'], "Violation regarding your report has been dismissed.", $violation['report_id']]);
        break;

    case 'issue_fine':
        $newStatus = 'Confirmed';
        $amount = (float)($input['amount'] ?? $violation['penalty_amount'] ?? 0);
        $note = "Fine of ₱" . number_format($amount, 2) . " issued";
        $uStmt = $pdo->prepare("UPDATE violations SET status = ?, penalty_type = 'Fine', penalty_amount = ?, issued_by = ? WHERE id = ?");
        $uStmt->execute([$newStatus, $amount, $actorId, $id]);
        $pdo->prepare("UPDATE users SET violation_count = violation_count + 1 WHERE id = ?")->execute([$violation['resident_id']]);
        $pdo->prepare("INSERT INTO notifications (user_id, type, message, report_id) VALUES (?, 'violation_fine', ?, ?)")->execute([$violation['resident_id'], "A fine of ₱" . number_format($amount, 2) . " has been issued for: {$violation['violation_type']}.", $violation['report_id']]);
        break;

    case 'suspend':
        $days = (int)($input['days'] ?? $violation['suspension_days'] ?? 7);
        $restoreDate = date('Y-m-d H:i:s', time() + ($days * 86400));
        $note = "Account suspended for $days days";
        $uStmt = $pdo->prepare("UPDATE violations SET status = 'Confirmed', penalty_type = 'Short Suspension', suspension_days = ?, issued_by = ? WHERE id = ?");
        $uStmt->execute([$days, $actorId, $id]);
        $pdo->prepare("UPDATE users SET violation_count = violation_count + 1 WHERE id = ?")->execute([$violation['resident_id']]);
        $pdo->prepare("UPDATE users SET status = 'Inactive', suspension_until = ? WHERE id = ? AND status = 'Active'")->execute([$restoreDate, $violation['resident_id']]);
        $pdo->prepare("INSERT INTO notifications (user_id, type, message, report_id) VALUES (?, 'violation_suspended', ?, ?)")->execute([$violation['resident_id'], "Your account has been suspended for $days days due to: {$violation['violation_type']}.", $violation['report_id']]);
        break;

    case 'reduce':
        $newSeverity = $input['new_severity'] ?? $violation['severity'];
        $newPenaltyType = $input['new_penalty_type'] ?? $violation['penalty_type'];
        $newAmount = (float)($input['new_amount'] ?? $violation['penalty_amount']);
        $note = trim($input['note'] ?? "Penalty reduced from {$violation['severity']} to $newSeverity");
        $uStmt = $pdo->prepare("UPDATE violations SET severity = ?, penalty_type = ?, penalty_amount = ?, issued_by = ? WHERE id = ?");
        $uStmt->execute([$newSeverity, $newPenaltyType, $newAmount, $actorId, $id]);
        $pdo->prepare("INSERT INTO notifications (user_id, type, message, report_id) VALUES (?, 'violation_reduced', ?, ?)")->execute([$violation['resident_id'], "Your violation penalty has been reduced to: $newSeverity ($newPenaltyType).", $violation['report_id']]);
        break;

    default:
        http_response_code(400);
        echo json_encode(['error' => 'Invalid action.']);
        exit;
}

// Log history
$histStmt = $pdo->prepare("INSERT INTO violation_history (violation_id, action, old_value, new_value, note, acted_by) VALUES (?, ?, ?, ?, ?, ?)");
$histStmt->execute([$id, $action, $oldStatus, $newStatus ?? $oldStatus, $note ?? '', $actorId]);

// Activity log
$logStmt = $pdo->prepare("INSERT INTO activity_logs (user_id, action, target_type, target_id, detail) VALUES (?, ?, 'violation', ?, ?)");
$logStmt->execute([$actorId, "violation_$action", $id, "Violation #$id: $action"]);

// Notify other admins
$notifStmt = $pdo->prepare("SELECT id FROM users WHERE role IN ('Admin','Super Admin') AND id != ?");
$notifStmt->execute([$actorId]);
$admins = $notifStmt->fetchAll();
foreach ($admins as $admin) {
    $nStmt = $pdo->prepare("INSERT INTO notifications (user_id, type, message, report_id) VALUES (?, 'violation_update', ?, ?)");
    $nStmt->execute([$admin['id'], "Violation #$id updated: $action by " . ($user['role'] ?? 'Admin'), $violation['report_id']]);
}

echo json_encode(['message' => "Violation $action'd.", 'status' => $newStatus ?? $violation['status']]);
