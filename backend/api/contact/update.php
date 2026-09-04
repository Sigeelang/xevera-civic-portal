<?php
header('Content-Type: application/json');
require_once __DIR__ . '/../config/cors.php';

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }
if ($_SERVER['REQUEST_METHOD'] !== 'POST') { http_response_code(405); echo json_encode(['error' => 'Method not allowed']); exit; }

require_once __DIR__ . '/../middleware/auth.php';
require_once __DIR__ . '/../middleware/write_ratelimit.php';
$user = requireRole(['Staff', 'Admin', 'Super Admin']);
xevera_write_rate_limit($pdo, 'contact.update');

require_once __DIR__ . '/../config/database.php';

$input = json_decode(file_get_contents('php://input'), true);
$id = (int)($input['id'] ?? 0);

if (!$id) { http_response_code(400); echo json_encode(['error' => 'Message ID is required.']); exit; }

$stmt = $pdo->prepare('SELECT * FROM contact_messages WHERE id = ?');
$stmt->execute([$id]);
$message = $stmt->fetch();

if (!$message) { http_response_code(404); echo json_encode(['error' => 'Message not found.']); exit; }

$workflowStatus = $input['workflow_status'] ?? null;
$valid = ['New', 'In Review', 'In Progress', 'Resolved', 'Closed'];
if ($workflowStatus !== null) {
    if (!in_array($workflowStatus, $valid, true)) {
        http_response_code(400);
        echo json_encode(['error' => 'Invalid workflow status.']);
        exit;
    }
    $stmt = $pdo->prepare('UPDATE contact_messages SET workflow_status = ? WHERE id = ?');
    $stmt->execute([$workflowStatus, $id]);

    $stmt = $pdo->prepare('INSERT INTO activity_logs (user_id, action, target_type, target_id, detail) VALUES (?, ?, ?, ?, ?)');
    $stmt->execute([$user['user_id'], 'update_concern', 'contact_message', $id, 'Concern ' . $id . ' marked ' . $workflowStatus]);

    echo json_encode(['message' => 'Concern status updated.']);
    exit;
}

http_response_code(400);
echo json_encode(['error' => 'Nothing to update.']);