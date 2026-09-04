<?php
header('Content-Type: application/json');
require_once __DIR__ . '/../config/cors.php';

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }
if ($_SERVER['REQUEST_METHOD'] !== 'POST') { http_response_code(405); echo json_encode(['error' => 'Method not allowed']); exit; }

require_once __DIR__ . '/../middleware/auth.php';
require_once __DIR__ . '/../middleware/write_ratelimit.php';
$user = requireAuth();
xevera_write_rate_limit($pdo, 'service_requests.create');
$role = $user['role'] ?? '';

if (!in_array($role, ['Staff', 'Admin', 'Super Admin', 'Resident'], true)) {
    http_response_code(403);
    echo json_encode(['error' => 'Forbidden. You do not have permission to access this resource.']);
    exit;
}

require_once __DIR__ . '/../config/database.php';

$input = json_decode(file_get_contents('php://input'), true);
if (!is_array($input)) { $input = $_POST; }

$isResident = $role === 'Resident';

$title = trim($input['title'] ?? '');
$category = trim($input['category'] ?? '');
$location = trim($input['location'] ?? '');
$residentName = $isResident ? trim($user['name'] ?? '') : trim($input['resident_name'] ?? '');
$residentEmail = $isResident ? trim($user['email'] ?? '') : trim($input['resident_email'] ?? '');
$residentPhone = $isResident ? '' : trim($input['resident_phone'] ?? '');
$priority = trim($input['priority'] ?? 'Normal');
$notes = trim($input['notes'] ?? '');
$status = $isResident ? 'Pending' : trim($input['status'] ?? 'Pending');
$assignedTo = $isResident ? null : (isset($input['assigned_to']) && $input['assigned_to'] !== '' ? (int)$input['assigned_to'] : null);

if (!$title) { http_response_code(400); echo json_encode(['error' => 'Service request title is required.']); exit; }
if (!$residentName) { http_response_code(400); echo json_encode(['error' => 'Resident name is required.']); exit; }
if ($residentPhone !== '' && !preg_match('/^09\d{9}$/', $residentPhone)) { http_response_code(400); echo json_encode(['error' => 'Phone number must be 11 digits starting with 09.']); exit; }

$validPriorities = ['Low', 'Normal', 'High', 'Urgent'];
if (!in_array($priority, $validPriorities, true)) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid priority.']);
    exit;
}

$validStatuses = ['Pending', 'Assigned', 'In Progress', 'Completed', 'Cancelled'];
if (!in_array($status, $validStatuses, true)) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid status.']);
    exit;
}

$stmt = $pdo->query('SELECT COALESCE(MAX(id), 0) + 1 FROM service_requests');
$nextId = (int)$stmt->fetchColumn();
$refId = 'SR-' . str_pad((string)$nextId, 4, '0', STR_PAD_LEFT);

$stmt = $pdo->prepare('INSERT INTO service_requests (ref_id, title, category, location, resident_name, resident_email, resident_phone, priority, status, assigned_to, notes, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
$stmt->execute([$refId, $title, $category, $location, $residentName, $residentEmail, $residentPhone, $priority, $status, $assignedTo, $notes, $user['user_id']]);
$requestId = (int)$pdo->lastInsertId();

$stmt = $pdo->prepare('INSERT INTO activity_logs (user_id, action, target_type, target_id, detail) VALUES (?, ?, ?, ?, ?)');
$stmt->execute([$user['user_id'], 'create_service_request', 'service_request', $requestId, 'Created service request ' . $refId . ' - ' . $title]);

echo json_encode(['success' => true, 'id' => $requestId, 'ref_id' => $refId]);