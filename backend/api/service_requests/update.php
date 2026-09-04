<?php
header('Content-Type: application/json');
require_once __DIR__ . '/../config/cors.php';

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }
if ($_SERVER['REQUEST_METHOD'] !== 'POST') { http_response_code(405); echo json_encode(['error' => 'Method not allowed']); exit; }

require_once __DIR__ . '/../middleware/auth.php';
require_once __DIR__ . '/../middleware/write_ratelimit.php';
$user = requireRole(['Staff', 'Admin', 'Super Admin']);
xevera_write_rate_limit($pdo, 'service_requests.update');

require_once __DIR__ . '/../config/database.php';

$input = json_decode(file_get_contents('php://input'), true);
$id = (int)($input['id'] ?? 0);

if (!$id) { http_response_code(400); echo json_encode(['error' => 'Service request ID is required.']); exit; }

$stmt = $pdo->prepare('SELECT * FROM service_requests WHERE id = ?');
$stmt->execute([$id]);
$request = $stmt->fetch();

if (!$request) { http_response_code(404); echo json_encode(['error' => 'Service request not found.']); exit; }

$updates = [];
$params = [];

if (array_key_exists('title', $input)) {
    $title = trim($input['title']);
    if (!$title) { http_response_code(400); echo json_encode(['error' => 'Service request title is required.']); exit; }
    $updates[] = 'title = ?';
    $params[] = $title;
}

if (array_key_exists('category', $input)) {
    $updates[] = 'category = ?';
    $params[] = trim($input['category']);
}

if (array_key_exists('location', $input)) {
    $updates[] = 'location = ?';
    $params[] = trim($input['location']);
}

if (array_key_exists('resident_name', $input)) {
    $updates[] = 'resident_name = ?';
    $params[] = trim($input['resident_name']);
}

if (array_key_exists('resident_email', $input)) {
    $updates[] = 'resident_email = ?';
    $params[] = trim($input['resident_email']);
}

if (array_key_exists('resident_phone', $input)) {
    $phoneVal = trim($input['resident_phone']);
    if ($phoneVal !== '' && !preg_match('/^09\d{9}$/', $phoneVal)) { http_response_code(400); echo json_encode(['error' => 'Phone number must be 11 digits starting with 09.']); exit; }
    $updates[] = 'resident_phone = ?';
    $params[] = $phoneVal;
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

if (array_key_exists('status', $input)) {
    $status = trim($input['status']);
    if (!in_array($status, ['Pending', 'Assigned', 'In Progress', 'Completed', 'Cancelled'], true)) {
        http_response_code(400);
        echo json_encode(['error' => 'Invalid status.']);
        exit;
    }
    $updates[] = 'status = ?';
    $params[] = $status;
}

if (array_key_exists('assigned_to', $input)) {
    $assignedTo = $input['assigned_to'] !== '' && $input['assigned_to'] !== null ? (int)$input['assigned_to'] : null;
    $updates[] = 'assigned_to = ?';
    $params[] = $assignedTo;
}

if (empty($updates)) { echo json_encode(['message' => 'Nothing to update.']); exit; }

$params[] = $id;
$stmt = $pdo->prepare('UPDATE service_requests SET ' . implode(', ', $updates) . ' WHERE id = ?');
$stmt->execute($params);

$detail = 'Updated service request ' . $id . ' (' . $request['ref_id'] . ')';
if (array_key_exists('status', $input) && $input['status'] !== $request['status']) $detail .= ' - status: ' . $input['status'];

$stmt = $pdo->prepare('INSERT INTO activity_logs (user_id, action, target_type, target_id, detail) VALUES (?, ?, ?, ?, ?)');
$stmt->execute([$user['user_id'], 'update_service_request', 'service_request', $id, $detail]);

echo json_encode(['message' => 'Service request updated successfully.']);