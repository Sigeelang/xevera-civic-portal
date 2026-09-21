<?php
header('Content-Type: application/json');
require_once __DIR__ . '/../config/cors.php';

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once __DIR__ . '/../middleware/auth.php';
require_once __DIR__ . '/../middleware/write_ratelimit.php';
$currentUser = requirePermission('users', ['Super Admin']);
xevera_write_rate_limit($pdo, 'users.delete');

require_once __DIR__ . '/../config/database.php';

$input = json_decode(file_get_contents('php://input'), true);
$userId = (int)($input['id'] ?? $_GET['id'] ?? 0);

if (!$userId) {
    http_response_code(400);
    echo json_encode(['error' => 'User ID is required.']);
    exit;
}

$stmt = $pdo->prepare('SELECT id, role, status FROM users WHERE id = ?');
$stmt->execute([$userId]);
$target = $stmt->fetch();
if (!$target) {
    http_response_code(404);
    echo json_encode(['error' => 'User not found.']);
    exit;
}

// Guard: a Super Admin cannot delete their own account.
if ($userId === (int)$currentUser['user_id']) {
    http_response_code(400);
    echo json_encode(['error' => 'You cannot delete your own account.']);
    exit;
}

// Guard: never leave the system without an active Super Admin.
if ($target['role'] === 'Super Admin' && $target['status'] === 'Active') {
    $stmt = $pdo->query("SELECT COUNT(*) FROM users WHERE role = 'Super Admin' AND status = 'Active' AND id <> " . (int)$userId);
    if ((int)$stmt->fetchColumn() === 0) {
        http_response_code(400);
        echo json_encode(['error' => 'Cannot delete the last active Super Admin.']);
        exit;
    }
}

$stmt = $pdo->prepare('UPDATE reports SET assigned_to = NULL WHERE assigned_to = ?');
$stmt->execute([$userId]);

$stmt = $pdo->prepare('DELETE FROM users WHERE id = ?');
$stmt->execute([$userId]);

$logStmt = $pdo->prepare('INSERT INTO activity_logs (user_id, action, target_type, target_id, detail) VALUES (?, ?, ?, ?, ?)');
$logStmt->execute([$currentUser['user_id'], 'delete_user', 'user', $userId, 'User deleted']);

echo json_encode(['message' => 'User deleted successfully.']);
