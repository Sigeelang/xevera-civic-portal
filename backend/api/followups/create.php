<?php
header('Content-Type: application/json');
require_once __DIR__ . '/../config/cors.php';

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }
if ($_SERVER['REQUEST_METHOD'] !== 'POST') { http_response_code(405); echo json_encode(['error' => 'Method not allowed']); exit; }

require_once __DIR__ . '/../middleware/auth.php';
require_once __DIR__ . '/../middleware/write_ratelimit.php';
$user = requireRole(['Staff', 'Admin', 'Super Admin']);
xevera_write_rate_limit($pdo, 'followups.create');

require_once __DIR__ . '/../config/database.php';

$input = json_decode(file_get_contents('php://input'), true);
$title = trim($input['title'] ?? '');
$relatedType = trim($input['related_type'] ?? '');
$relatedId = (int)($input['related_id'] ?? 0);
$dueDate = trim($input['due_date'] ?? '') ?: null;
$ownerId = isset($input['owner_id']) && $input['owner_id'] !== '' ? (int)$input['owner_id'] : null;
$priority = trim($input['priority'] ?? 'Normal');
$status = trim($input['status'] ?? 'Pending');
$notes = trim($input['notes'] ?? '');

if (!$title) { http_response_code(400); echo json_encode(['error' => 'Follow-up title is required.']); exit; }

if (!in_array($relatedType, ['report', 'concern'], true)) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid related type.']);
    exit;
}

// Strict link: the follow-up must reference an existing report or concern.
if ($relatedType === 'report') {
    $stmt = $pdo->prepare('SELECT ref_id FROM reports WHERE id = ?');
} else {
    $stmt = $pdo->prepare('SELECT id FROM contact_messages WHERE id = ?');
}
$stmt->execute([$relatedId]);
$related = $stmt->fetch();
if (!$related) {
    http_response_code(400);
    echo json_encode(['error' => $relatedType === 'report' ? 'Linked report not found.' : 'Linked concern not found.']);
    exit;
}

$validPriorities = ['Low', 'Normal', 'High', 'Urgent'];
if (!in_array($priority, $validPriorities, true)) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid priority.']);
    exit;
}

$validStatuses = ['Pending', 'Waiting', 'Completed'];
if (!in_array($status, $validStatuses, true)) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid status.']);
    exit;
}

if ($dueDate !== null && !preg_match('/^\d{4}-\d{2}-\d{2}$/', $dueDate)) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid due date.']);
    exit;
}

$stmt = $pdo->query('SELECT COALESCE(MAX(id), 0) + 1 FROM follow_ups');
$nextId = (int)$stmt->fetchColumn();
$refId = 'FU-' . str_pad((string)$nextId, 4, '0', STR_PAD_LEFT);

$stmt = $pdo->prepare('INSERT INTO follow_ups (ref_id, title, related_type, related_id, due_date, owner_id, priority, status, notes, created_by, completed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
$stmt->execute([$refId, $title, $relatedType, $relatedId, $dueDate, $ownerId, $priority, $status, $notes, $user['user_id'], $status === 'Completed' ? date('Y-m-d H:i:s') : null]);
$followUpId = (int)$pdo->lastInsertId();

$detail = 'Created follow-up ' . $refId . ' - ' . $title . ' linked to ' . $relatedType . ' ' . $relatedId;

$stmt = $pdo->prepare('INSERT INTO activity_logs (user_id, action, target_type, target_id, detail) VALUES (?, ?, ?, ?, ?)');
$stmt->execute([$user['user_id'], 'create_follow_up', 'follow_up', $followUpId, $detail]);

echo json_encode(['success' => true, 'id' => $followUpId, 'ref_id' => $refId]);