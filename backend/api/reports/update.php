<?php
header('Content-Type: application/json');
require_once __DIR__ . '/../config/cors.php';

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once __DIR__ . '/../middleware/auth.php';
require_once __DIR__ . '/../middleware/write_ratelimit.php';
require_once __DIR__ . '/../middleware/upload.php';
$user = requirePermission('reports', ['Staff', 'Admin', 'Super Admin']);
xevera_write_rate_limit($pdo, 'reports.update');

require_once __DIR__ . '/../config/database.php';

/*
 * Accepts JSON bodies AND multipart FormData (used by staff resolution
 * submissions that attach evidence photos in $_FILES['photos']).
 */
$input = json_decode(file_get_contents('php://input'), true);
if (!is_array($input)) {
    $input = $_POST ?: [];
}
$refId = trim($_GET['id'] ?? $input['id'] ?? '');

if (!$refId) {
    http_response_code(400);
    echo json_encode(['error' => 'Report ID is required.']);
    exit;
}

/*
 * Accept either the public ref_id (XR-2026-…) or the numeric row id
 * (used by the violation-review screens).
 */
$byNumericId = ctype_digit($refId);
$idColumn = $byNumericId ? 'id' : 'ref_id';
$idValue = $byNumericId ? (int)$refId : $refId;

$stmt = $pdo->prepare("SELECT * FROM reports WHERE $idColumn = ?");
$stmt->execute([$idValue]);
$report = $stmt->fetch();

if (!$report) {
    http_response_code(404);
    echo json_encode(['error' => 'Report not found.']);
    exit;
}

$currentStatus = $report['status'];
$role = $user['role'] ?? 'Staff';
$isManager = in_array($role, ['Admin', 'Super Admin'], true);
$isAssignee = $report['assigned_to'] && (int)$report['assigned_to'] === (int)($user['user_id'] ?? 0);

$assignedTo = array_key_exists('assigned_to', $input) ? $input['assigned_to'] : null;
$status = $input['status'] ?? null;
$priority = $input['priority'] ?? null;
$remarks = $input['remarks'] ?? null;
$resolution = $input['resolution'] ?? null;
$rejectionReason = $input['rejection_reason'] ?? null;
$flagFake = !empty($input['flag_fake']);
$flagReason = trim($input['flag_reason'] ?? '');
$note = trim($input['note'] ?? '');

/*
 * Staff work-update compatibility: StaffAssignedReportsPage and
 * ReportsMgmtPage send the update text as `remarks`. Treat it as the
 * history note when no explicit `note` was given, so staff messages
 * actually appear in Updates & Responses instead of being silently
 * dropped (remarks is still saved to the reports table as before).
 */
if ($note === '' && trim((string)($remarks ?? '')) !== '') {
    $note = trim((string)$remarks);
}

// Legacy input alias — never stored, mapped to the canonical working status.
if ($status === 'Claimed') {
    $status = 'In Progress';
}

$validStatuses = ['Pending', 'Verified', 'Assigned', 'In Progress', 'Resolved', 'Closed', 'Rejected'];
if ($status && !in_array($status, $validStatuses, true)) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid status.']);
    exit;
}

// ---- Assignment handling ----
$assignmentAction = 'none';
$assignId = null;
if ($assignedTo !== null) {
    if ($assignedTo === '' || $assignedTo === 0 || $assignedTo === '0' || $assignedTo === null) {
        $assignmentAction = 'clear';
    } else {
        $assignmentAction = 'assign';
        $assignId = (int)$assignedTo;
    }
}

if ($assignmentAction === 'assign') {
    if (!$isManager) {
        http_response_code(403);
        echo json_encode(['error' => 'Only admins can assign reports.']);
        exit;
    }
    $stmt = $pdo->prepare('SELECT id, role, status AS user_status FROM users WHERE id = ?');
    $stmt->execute([$assignId]);
    $target = $stmt->fetch();
    if (!$target || $target['role'] !== 'Staff' || $target['user_status'] !== 'Active') {
        http_response_code(400);
        echo json_encode(['error' => 'Selected user is not an active staff member.']);
        exit;
    }
} elseif ($assignmentAction === 'clear') {
    if (!$isManager) {
        http_response_code(403);
        echo json_encode(['error' => 'Only admins can change report assignment.']);
        exit;
    }
}

// ---- Status transition gate (structure + role) ----
$statusChanged = $status && $status !== $currentStatus;
if ($statusChanged) {
    $gates = [
        'Pending'     => ['Verified' => $isManager, 'Rejected' => $isManager],
        'Verified'    => ['Assigned' => $isManager, 'Rejected' => $isManager],
        'Assigned'    => ['In Progress' => $isManager || $isAssignee],
        'In Progress' => ['Resolved' => $isManager || $isAssignee],
        'Resolved'    => ['Closed' => $isManager, 'In Progress' => $isManager],
        'Closed'      => [],
        'Rejected'    => ['Pending' => $isManager],
    ];
    $allowed = $gates[$currentStatus][$status] ?? false;
    // Combined assign+start shortcut: Verified -> In Progress is allowed only when
    // a staff member is being assigned in the same request by an admin.
    if (!$allowed && $status === 'In Progress' && $currentStatus === 'Verified' && $assignmentAction === 'assign' && $isManager) {
        $allowed = true;
    }
    if (!$allowed) {
        http_response_code(400);
        echo json_encode(['error' => "Cannot change a report from {$currentStatus} to {$status}."]);
        exit;
    }
}

/*
 * ---- Work-note permission ----
 * A note with no status change and no assignment change is a progress update
 * ("Add Update"). Only the assigned staff member or an admin may post it.
 */
if (!$statusChanged && $assignmentAction === 'none' && $note !== '' && !$isManager && !$isAssignee) {
    http_response_code(403);
    echo json_encode(['error' => 'Only the assigned staff member or an admin can add an update.']);
    exit;
}

// ---- Required fields per transition ----
if ($statusChanged && $status === 'Rejected' && trim((string)$rejectionReason) === '') {
    http_response_code(400);
    echo json_encode(['error' => 'A rejection reason is required.']);
    exit;
}
if ($statusChanged && $status === 'Resolved' && trim((string)$resolution) === '') {
    http_response_code(400);
    echo json_encode(['error' => 'Resolution details are required.']);
    exit;
}

// Assigning a verified report (without an explicit status) moves it to Assigned.
if ($assignmentAction === 'assign' && !$status && $currentStatus === 'Verified') {
    $status = 'Assigned';
    $statusChanged = true;
}

// ---- Build UPDATE ----
$updates = [];
$params = [];

// ---- Flag as Fake ----
if ($flagFake) {
    if (!$isManager) {
        http_response_code(403);
        echo json_encode(['error' => 'Only admins can flag reports as fake.']);
        exit;
    }
    /* Flagging belongs to the verification stage: only reports still
       pending verification can be flagged (verified/assigned/resolved/
       closed/rejected reports are past that point). */
    if (($currentStatus ?? '') !== 'Pending') {
        http_response_code(400);
        echo json_encode(['error' => 'Only pending reports can be flagged as fake.']);
        exit;
    }
    $updates[] = 'is_suspicious = 1';
    if ($flagReason !== '') {
        $updates[] = 'suspicion_reason = ?';
        $params[] = $flagReason;
    }
    /*
     * Data repair: a report must always carry a valid workflow status.
     * Rows with an empty/unknown status (legacy anomalies) fall back to
     * Pending so they keep appearing in every queue and filter.
     */
    $validWorkflow = ['Pending', 'Verified', 'Assigned', 'In Progress', 'Resolved', 'Closed', 'Rejected'];
    if (!in_array($currentStatus, $validWorkflow, true)) {
        $updates[] = 'status = ?';
        $params[] = 'Pending';
    }
    // Record in history
    $histStmt = $pdo->prepare('INSERT INTO report_status_history (report_id, old_status, new_status, acted_by, note) VALUES (?, ?, ?, ?, ?)');
    $histStmt->execute([$report['id'], $currentStatus, $currentStatus, $user['user_id'], 'Flagged as fake: ' . ($flagReason ?: 'Staff recommendation')]);
    // Activity log
    $logDetail = 'Flagged report ' . $refId . ' as fake';
    if ($flagReason) $logDetail .= ': ' . $flagReason;
    $logStmt = $pdo->prepare('INSERT INTO activity_logs (user_id, action, target_type, target_id, detail) VALUES (?, ?, ?, ?, ?)');
    $logStmt->execute([$user['user_id'], 'flag_fake', 'report', $report['id'], $logDetail]);
    // Notify other admins
    try {
        $adminIds = $pdo->query("SELECT id FROM users WHERE role IN ('Admin', 'Super Admin') AND status = 'Active' AND id != " . (int)$user['user_id'])->fetchAll(PDO::FETCH_COLUMN);
        foreach ($adminIds as $adminId) {
            insertNotification($pdo, (int)$adminId, 'report_flagged', 'Report ' . $refId . ' was flagged as fake by ' . ($user['name'] ?? 'staff') . '.', (int)$report['id']);
        }
    } catch (PDOException $e) { /* notification must never break report update */ }
    // Notify the reporter so the flag is reflected on the resident portal
    // (their report renders as "Under Review" via getEffectiveStatus).
    try {
        if (!empty($report['reporter_user_id']) && notifyStatusEnabled($pdo, (int)$report['reporter_user_id'])) {
            insertNotification($pdo, (int)$report['reporter_user_id'], 'report_flagged', 'Your report ' . $refId . ' was flagged for review by an administrator.', (int)$report['id']);
        }
    } catch (PDOException $e) { /* notification must never break report update */ }
}

if ($assignmentAction === 'assign') {
    $updates[] = 'assigned_to = ?';
    $params[] = $assignId;
    $updates[] = 'assigned_at = ?';
    $params[] = date('Y-m-d H:i:s');
} elseif ($assignmentAction === 'clear') {
    $updates[] = 'assigned_to = NULL';
    $updates[] = 'assigned_at = NULL';
}

if ($priority && in_array($priority, ['Normal', 'High', 'Urgent'], true)) {
    $updates[] = 'priority = ?';
    $params[] = $priority;
}

if ($remarks !== null) {
    $updates[] = 'remarks = ?';
    $params[] = trim((string)$remarks);
}

if ($resolution !== null) {
    $updates[] = 'resolution = ?';
    $params[] = trim((string)$resolution);
}

/*
 * Resolution evidence photos (multipart only). Max 2 images, 5MB each,
 * JPEG/PNG/WebP - validated with getimagesize, stored in uploads/ and
 * saved to the report's evidence_paths JSON.
 *
 * Staff uploads are kept SEPARATE from the reporter's original photo_paths
 * so residents can see exactly what the staff member uploaded as proof
 * of resolution (rather than the originals relabeled as evidence).
 */
if (!empty($_FILES['photos'])) {
    $files = $_FILES['photos'];
    $submitted = count(is_array($files['name']) ? $files['name'] : []);
    if ($submitted > 2) {
        http_response_code(400);
        echo json_encode(['error' => 'A maximum of 2 evidence photos is allowed.']);
        exit;
    }
    $existingEvidence = json_decode($report['evidence_paths'] ?? '[]', true) ?: [];
    $uploadDir = __DIR__ . '/../../uploads/';
    if (!is_dir($uploadDir)) {
        mkdir($uploadDir, 0755, true);
    }
    $added = 0;
    foreach ($files['name'] as $i => $name) {
        $err = $files['error'][$i] ?? UPLOAD_ERR_NO_FILE;
        if ($err === UPLOAD_ERR_NO_FILE) continue;
        if ($err !== UPLOAD_ERR_OK) continue;
        $fFile = [
            'name'     => $name,
            'tmp_name' => $files['tmp_name'][$i] ?? '',
            'error'    => $err,
            'size'     => $files['size'][$i] ?? 0,
        ];
        $validated = xevera_validate_image_upload($fFile);
        $newName = uniqid('evidence_') . '.' . $validated['ext'];
        if (move_uploaded_file($files['tmp_name'][$i], $uploadDir . $newName)) {
            $existingEvidence[] = $newName;
            $added++;
        }
    }
    if ($added > 0) {
        $updates[] = 'evidence_paths = ?';
        $params[] = json_encode(array_values($existingEvidence));
    }
}

/*
 * ---- Violation-review flag handling (managers only) ----
 * The violation screens clear/set the suspicious flag when a flagged
 * report is dismissed or re-opened. Dismissal keeps the existing
 * suspicion_reason (audit trail for the Dismissed queue) unless an
 * explicit replacement is provided; staff_notes are stored in remarks.
 */
$flagDismissNote = '';
if (array_key_exists('is_suspicious', $input) && $isManager) {
    $flagValue = !empty($input['is_suspicious']) ? 1 : 0;
    $updates[] = 'is_suspicious = ?';
    $params[] = $flagValue;
    $incomingReason = trim((string)($input['suspicion_reason'] ?? ''));
    if ($incomingReason !== '') {
        $updates[] = 'suspicion_reason = ?';
        $params[] = $incomingReason;
    }
    if (array_key_exists('staff_notes', $input) && trim((string)$input['staff_notes']) !== '') {
        $flagDismissNote = trim((string)$input['staff_notes']);
        $updates[] = 'remarks = ?';
        $params[] = $flagDismissNote;
    }
    if ($flagValue === 0 && $flagDismissNote !== '') {
        $histStmt = $pdo->prepare('INSERT INTO report_status_history (report_id, old_status, new_status, acted_by, note) VALUES (?, ?, ?, ?, ?)');
        $histStmt->execute([$report['id'], $currentStatus, $currentStatus, $user['user_id'], $flagDismissNote]);
    }
    if ($flagValue === 0) {
        /*
         * Dismiss-after-confirm repair: if this report already carries a
         * live violation, dismiss it too — otherwise the resident stays
         * penalized for a dismissed report. The violation record is kept
         * for audit; a suspension still held by THIS violation's window
         * is lifted. Notifications never break the update.
         */
        try {
            $vStmt = $pdo->prepare("SELECT id, resident_id, penalty_type, penalty_end_at, restriction_until FROM violations WHERE report_id = ? AND status IN ('Pending Review','Confirmed','Appealed') ORDER BY id DESC LIMIT 1");
            $vStmt->execute([(int)$report['id']]);
            $linked = $vStmt->fetch();
            if ($linked) {
                $pdo->prepare('UPDATE violations SET status = ?, issued_by = ? WHERE id = ?')->execute(['Dismissed', (int)$user['user_id'], (int)$linked['id']]);
                $pdo->prepare('INSERT INTO violation_history (violation_id, action, new_value, note, acted_by) VALUES (?, ?, ?, ?, ?)')
                    ->execute([(int)$linked['id'], 'dismissed', 'Dismissed', $flagDismissNote !== '' ? $flagDismissNote : 'Flag dismissed: report cleared', (int)$user['user_id']]);
                $pdo->prepare('UPDATE users SET violation_count = GREATEST(0, violation_count - 1) WHERE id = ?')->execute([(int)$linked['resident_id']]);
                // Lift the suspension only when the account is still held
                // by this exact violation window (a newer penalty may apply).
                $winEnd = $linked['penalty_end_at'] ?: $linked['restriction_until'];
                if ($winEnd) {
                    $uStmt = $pdo->prepare('SELECT status, suspension_until FROM users WHERE id = ?');
                    $uStmt->execute([(int)$linked['resident_id']]);
                    $held = $uStmt->fetch();
                    if ($held && $held['status'] === 'Inactive' && $held['suspension_until'] && substr((string)$held['suspension_until'], 0, 19) === substr((string)$winEnd, 0, 19)) {
                        $pdo->prepare("UPDATE users SET status = 'Active', suspension_until = NULL WHERE id = ?")->execute([(int)$linked['resident_id']]);
                    }
                }
                $pdo->prepare("INSERT INTO notifications (user_id, type, message, report_id) VALUES (?, 'violation_dismissed', ?, ?)")->execute([(int)$linked['resident_id'], 'Violation regarding your report ' . $refId . ' has been dismissed.', (int)$report['id']]);
            } elseif (!empty($report['reporter_user_id']) && notifyStatusEnabled($pdo, (int)$report['reporter_user_id'])) {
                insertNotification($pdo, (int)$report['reporter_user_id'], 'report_status', 'Your report ' . $refId . ' was reviewed and cleared.', (int)$report['id']);
            }
        } catch (Throwable $e) { /* dismissal extras must never break report update */ }
    }
}

if ($status) {
    $updates[] = 'status = ?';
    $params[] = $status;
    if ($status === 'Verified') {
        $updates[] = 'verified_at = ?';
        $params[] = date('Y-m-d H:i:s');
        $updates[] = 'verified_by = ?';
        $params[] = (int)$user['user_id'];
    }
    if ($status === 'Resolved') {
        $updates[] = 'resolved_at = ?';
        $params[] = date('Y-m-d H:i:s');
    }
    if ($status === 'Closed') {
        $updates[] = 'closed_at = ?';
        $params[] = date('Y-m-d H:i:s');
    }
    if ($status === 'Rejected') {
        $updates[] = 'rejection_reason = ?';
        $params[] = trim((string)$rejectionReason) !== '' ? trim((string)$rejectionReason) : null;
    }
}

if (!empty($updates)) {
    $params[] = $idValue;
    $stmt = $pdo->prepare("UPDATE reports SET " . implode(', ', $updates) . " WHERE $idColumn = ?");
    $stmt->execute($params);
}

// ---- History ----
$historyNote = $note;
if ($assignmentAction === 'assign' && !$statusChanged) {
    $assignName = '';
    $stmt = $pdo->prepare('SELECT name FROM users WHERE id = ?');
    $stmt->execute([$assignId]);
    $assignName = (string)$stmt->fetchColumn();
    $historyNote = $historyNote ?: 'Report assigned to ' . $assignName;
    $histStmt = $pdo->prepare('INSERT INTO report_status_history (report_id, old_status, new_status, acted_by, note) VALUES (?, ?, ?, ?, ?)');
    $histStmt->execute([$report['id'], $currentStatus, $currentStatus, $user['user_id'], $historyNote]);
} elseif ($assignmentAction === 'clear' && !$statusChanged) {
    $historyNote = $historyNote ?: 'Assignment cleared';
    $histStmt = $pdo->prepare('INSERT INTO report_status_history (report_id, old_status, new_status, acted_by, note) VALUES (?, ?, ?, ?, ?)');
    $histStmt->execute([$report['id'], $currentStatus, $currentStatus, $user['user_id'], $historyNote]);
} elseif ($statusChanged) {
    /*
     * Include the action-specific details in the history note so the
     * Updates & Responses section shows what actually happened - the
     * resolution text, the rejection reason, or the assignee name -
     * instead of a generic status label. The reporter reads these notes.
     */
    if ($historyNote === '') {
        if ($status === 'Resolved' && trim((string)$resolution) !== '') {
            $historyNote = trim((string)$resolution);
        } elseif ($status === 'Rejected' && trim((string)$rejectionReason) !== '') {
            $historyNote = trim((string)$rejectionReason);
        } elseif ($status === 'Assigned' && $assignmentAction === 'assign' && !empty($assignId)) {
            $assignName = '';
            $stmt = $pdo->prepare('SELECT name FROM users WHERE id = ?');
            $stmt->execute([(int)$assignId]);
            $assignName = (string)$stmt->fetchColumn();
            if ($assignName !== '') {
                $historyNote = 'Report assigned to ' . $assignName;
            }
        }
    }
    $histStmt = $pdo->prepare('INSERT INTO report_status_history (report_id, old_status, new_status, acted_by, note) VALUES (?, ?, ?, ?, ?)');
    $histStmt->execute([$report['id'], $currentStatus, $status, $user['user_id'], $historyNote]);
} elseif ($historyNote !== '') {
    /*
     * Progress update: a work note with no status change. Recorded in the
     * same history table (old_status = new_status = current) so the note is
     * visible on the report instead of only in the activity log.
     */
    $histStmt = $pdo->prepare('INSERT INTO report_status_history (report_id, old_status, new_status, acted_by, note) VALUES (?, ?, ?, ?, ?)');
    $histStmt->execute([$report['id'], $currentStatus, $currentStatus, $user['user_id'], $historyNote]);
}

// ---- Activity log ----
$detail = 'Updated report ' . $refId;
if ($statusChanged) $detail .= ' - status: ' . $status;
if ($assignmentAction === 'assign') $detail .= ' - assigned to staff ' . $assignId;
if ($assignmentAction === 'clear') $detail .= ' - assignment cleared';
if ($priority && in_array($priority, ['Normal', 'High', 'Urgent'], true)) $detail .= ' - priority: ' . $priority;
if ($note) $detail .= ' - note: ' . $note;

$stmt = $pdo->prepare('INSERT INTO activity_logs (user_id, action, target_type, target_id, detail) VALUES (?, ?, ?, ?, ?)');
$stmt->execute([$user['user_id'], 'update_report', 'report', $report['id'], $detail]);

// ---- Notifications (integrate with existing notifications table) ----
function insertNotification(PDO $pdo, int $userId, string $type, string $message, ?int $reportId): void {
    $stmt = $pdo->prepare('INSERT INTO notifications (user_id, report_id, type, message, is_read, created_at) VALUES (?, ?, ?, ?, 0, NOW())');
    $stmt->execute([$userId, $reportId, $type, $message]);
}

function notifyStatusEnabled(PDO $pdo, int $userId): bool {
    $stmt = $pdo->prepare('SELECT notify_status FROM notification_prefs WHERE user_id = ?');
    $stmt->execute([$userId]);
    $v = $stmt->fetchColumn();
    return $v === false || (int)$v === 1;
}

$reporterId = $report['reporter_user_id'] ? (int)$report['reporter_user_id'] : null;

if ($assignmentAction === 'assign' && $assignId) {
    insertNotification($pdo, $assignId, 'report_assigned', 'A new report ' . $refId . ' has been assigned to you.', (int)$report['id']);
}
if ($status === 'Verified' && $reporterId && notifyStatusEnabled($pdo, $reporterId)) {
    insertNotification($pdo, $reporterId, 'report_status', 'Your report ' . $refId . ' has been verified.', (int)$report['id']);
}
if ($status === 'Rejected' && $reporterId && notifyStatusEnabled($pdo, $reporterId)) {
    insertNotification($pdo, $reporterId, 'report_status', 'Your report ' . $refId . ' was rejected.', (int)$report['id']);
}
if ($status === 'Resolved' && $reporterId && notifyStatusEnabled($pdo, $reporterId)) {
    insertNotification($pdo, $reporterId, 'report_status', 'Your report ' . $refId . ' has been resolved.', (int)$report['id']);
}
if ($status === 'Closed' && $reporterId && notifyStatusEnabled($pdo, $reporterId)) {
    insertNotification($pdo, $reporterId, 'report_status', 'Your report ' . $refId . ' has been closed.', (int)$report['id']);
}

// Notify Admin/Super Admin on all status changes (they oversee the system)
if ($status && in_array($status, ['Verified', 'Rejected', 'Resolved', 'Closed', 'In Progress', 'Pending'], true)) {
    try {
        $adminIds = $pdo->query("SELECT id FROM users WHERE role IN ('Admin', 'Super Admin') AND status = 'Active' AND id != " . (int)$user['user_id'])->fetchAll(PDO::FETCH_COLUMN);
        $statusMessages = [
            'Verified'   => 'Report ' . $refId . ' has been verified.',
            'Rejected'   => 'Report ' . $refId . ' was rejected.',
            'Resolved'   => 'Report ' . $refId . ' has been resolved.',
            'Closed'     => 'Report ' . $refId . ' has been closed.',
            'In Progress'=> 'Report ' . $refId . ' is now in progress.',
            'Pending'    => 'Report ' . $refId . ' is now pending review.',
        ];
        $adminMsg = $statusMessages[$status] ?? 'Report ' . $refId . ' status changed to ' . $status . '.';
        foreach ($adminIds as $adminId) {
            insertNotification($pdo, (int)$adminId, 'report_status', $adminMsg, (int)$report['id']);
        }
    } catch (PDOException $e) { /* notification must never break report update */ }
}

echo json_encode(['message' => 'Report updated successfully.']);