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
$user = requireRole(['Staff', 'Admin', 'Super Admin']);
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

$stmt = $pdo->prepare('SELECT * FROM reports WHERE ref_id = ?');
$stmt->execute([$refId]);
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
$note = trim($input['note'] ?? '');

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
 * appended to the report's existing photo_paths JSON.
 */
if (!empty($_FILES['photos'])) {
    $files = $_FILES['photos'];
    $submitted = count(is_array($files['name']) ? $files['name'] : []);
    if ($submitted > 2) {
        http_response_code(400);
        echo json_encode(['error' => 'A maximum of 2 evidence photos is allowed.']);
        exit;
    }
    $existingPhotos = json_decode($report['photo_paths'] ?? '[]', true) ?: [];
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
            $existingPhotos[] = $newName;
            $added++;
        }
    }
    if ($added > 0) {
        $updates[] = 'photo_paths = ?';
        $params[] = json_encode(array_values($existingPhotos));
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
    $params[] = $refId;
    $stmt = $pdo->prepare('UPDATE reports SET ' . implode(', ', $updates) . ' WHERE ref_id = ?');
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
    $histStmt = $pdo->prepare('INSERT INTO report_status_history (report_id, old_status, new_status, acted_by, note) VALUES (?, ?, ?, ?, ?)');
    $histStmt->execute([$report['id'], $currentStatus, $status, $user['user_id'], $historyNote]);
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

echo json_encode(['message' => 'Report updated successfully.']);