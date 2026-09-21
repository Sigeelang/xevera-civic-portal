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
xevera_write_rate_limit($pdo, 'users.toggle');

require_once __DIR__ . '/../config/database.php';

$input = json_decode(file_get_contents('php://input'), true);
$userId = (int)($input['id'] ?? 0);

if (!$userId) {
    http_response_code(400);
    echo json_encode(['error' => 'User ID is required.']);
    exit;
}

$stmt = $pdo->prepare('SELECT id, role, status FROM users WHERE id = ?');
$stmt->execute([$userId]);
$user = $stmt->fetch();

if (!$user) {
    http_response_code(404);
    echo json_encode(['error' => 'User not found.']);
    exit;
}

// A Super Admin cannot deactivate their own account.
if ($userId === (int)$currentUser['user_id']) {
    http_response_code(400);
    echo json_encode(['error' => 'You cannot deactivate your own account.']);
    exit;
}

/*
 * Never allow deactivating the last active Super Admin - that would
 * lock everyone out of user management (mirrors delete.php).
 */
$newStatus = $user['status'] === 'Active' ? 'Inactive' : 'Active';
if ($user['role'] === 'Super Admin' && $newStatus === 'Inactive') {
    $stmt = $pdo->prepare("SELECT COUNT(*) FROM users WHERE role = 'Super Admin' AND status = 'Active'");
    $stmt->execute();
    if ((int)$stmt->fetchColumn() <= 1) {
        http_response_code(400);
        echo json_encode(['error' => 'Cannot deactivate the last active Super Admin.']);
        exit;
    }
}

$stmt = $pdo->prepare('UPDATE users SET status = ? WHERE id = ?');
$stmt->execute([$newStatus, $userId]);

$logStmt = $pdo->prepare('INSERT INTO activity_logs (user_id, action, target_type, target_id, detail) VALUES (?, ?, ?, ?, ?)');
$logStmt->execute([$currentUser['user_id'], 'toggle_user', 'user', $userId, 'User toggled to ' . $newStatus]);

echo json_encode([
    'message' => 'User status updated.',
    'status' => $newStatus,
]);
