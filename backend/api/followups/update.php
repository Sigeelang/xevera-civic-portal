<?php
header('Content-Type: application/json');
require_once __DIR__ . '/../config/cors.php';

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }
if ($_SERVER['REQUEST_METHOD'] !== 'POST') { http_response_code(405); echo json_encode(['error' => 'Method not allowed']); exit; }

require_once __DIR__ . '/../middleware/auth.php';
require_once __DIR__ . '/../middleware/write_ratelimit.php';
$user = requirePermission('tasks', ['Staff', 'Admin', 'Super Admin']);
xevera_write_rate_limit($pdo, 'followups.update');

require_once __DIR__ . '/../config/database.php';

$input = json_decode(file_get_contents('php://input'), true);
$id = (int)($input['id'] ?? 0);

if (!$id) { http_response_code(400); echo json_encode(['error' => 'Follow-up ID is required.']); exit; }

$stmt = $pdo->prepare('SELECT * FROM follow_ups WHERE id = ?');
$stmt->execute([$id]);
$followUp = $stmt->fetch();

if (!$followUp) { http_response_code(404); echo json_encode(['error' => 'Follow-up not found.']); exit; }

$updates = [];
$params = [];

if (array_key_exists('title', $input)) {
    $title = trim($input['title']);
    if (!$title) { http_response_code(400); echo json_encode(['error' => 'Follow-up title is required.']); exit; }
    $updates[] = 'title = ?';
    $params[] = $title;
}

if (array_key_exists('related_type', $input) || array_key_exists('related_id', $input)) {
    $relatedType = trim($input['related_type'] ?? $followUp['related_type']);
    $relatedId = (int)($input['related_id'] ?? $followUp['related_id']);
    if (!in_array($relatedType, ['report', 'concern'], true)) {
        http_response_code(400);
        echo json_encode(['error' => 'Invalid related type.']);
        exit;
    }
    // Strict link: the follow-up must reference an existing report or concern.
    if ($relatedType === 'report') {
        $chk = $pdo->prepare('SELECT id FROM reports WHERE id = ?');
    } else {
        $chk = $pdo->prepare('SELECT id FROM contact_messages WHERE id = ?');
    }
    $chk->execute([$relatedId]);
    if (!$chk->fetch()) {
        http_response_code(400);
        echo json_encode(['error' => $relatedType === 'report' ? 'Linked report not found.' : 'Linked concern not found.']);
        exit;
    }
    $updates[] = 'related_type = ?';
    $params[] = $relatedType;
    $updates[] = 'related_id = ?';
    $params[] = $relatedId;
}

if (array_key_exists('notes', $input)) {
    $updates[] = 'notes = ?';
    $params[] = trim($input['notes']);
}

if (array_key_exists('priority', $input)) {
    $priority = trim($input['priority']);
    if (!in_array($priority, ['Low', 'Normal', 'High', 'Urgent'], true)) {
        http_response_code(400);
        echo json_encode(['error' => 'Invalid priority.']);
        exit;
    }
    $updates[] = 'priority = ?';
    $params[] = $priority;
}

if (array_key_exists('owner_id', $input)) {
    $ownerId = $input['owner_id'] !== '' && $input['owner_id'] !== null ? (int)$input['owner_id'] : null;
    $updates[] = 'owner_id = ?';
    $params[] = $ownerId;
}

if (array_key_exists('due_date', $input)) {
    $dueDate = trim($input['due_date']) ?: null;
    if ($dueDate !== null && !preg_match('/^\d{4}-\d{2}-\d{2}$/', $dueDate)) {
        http_response_code(400);
        echo json_encode(['error' => 'Invalid due date.']);
        exit;
    }
    $updates[] = 'due_date = ?';
    $params[] = $dueDate;
}

if (array_key_exists('status', $input)) {
    $status = trim($input['status']);
    if (!in_array($status, ['Pending', 'Waiting', 'Completed'], true)) {
        http_response_code(400);
        echo json_encode(['error' => 'Invalid status.']);
        exit;
    }
    $updates[] = 'status = ?';
    $params[] = $status;
    if ($status === 'Completed' && $followUp['status'] !== 'Completed') {
        $updates[] = 'completed_at = ?';
        $params[] = date('Y-m-d H:i:s');
    } elseif ($status !== 'Completed' && $followUp['status'] === 'Completed') {
        $updates[] = 'completed_at = ?';
        $params[] = null;
    }
}

if (empty($updates)) { echo json_encode(['message' => 'Nothing to update.']); exit; }

$params[] = $id;
$stmt = $pdo->prepare('UPDATE follow_ups SET ' . implode(', ', $updates) . ' WHERE id = ?');
$stmt->execute($params);

$detail = 'Updated follow-up ' . $id . ' (' . $followUp['ref_id'] . ')';
if (array_key_exists('status', $input) && $input['status'] !== $followUp['status']) $detail .= ' - status: ' . $input['status'];

$stmt = $pdo->prepare('INSERT INTO activity_logs (user_id, action, target_type, target_id, detail) VALUES (?, ?, ?, ?, ?)');
$stmt->execute([$user['user_id'], 'update_follow_up', 'follow_up', $id, $detail]);

echo json_encode(['message' => 'Follow-up updated successfully.']);