<?php
header('Content-Type: application/json');
require_once __DIR__ . '/../config/cors.php';

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }
if ($_SERVER['REQUEST_METHOD'] !== 'POST') { http_response_code(405); echo json_encode(['error' => 'Method not allowed']); exit; }

require_once __DIR__ . '/../middleware/auth.php';
require_once __DIR__ . '/../middleware/write_ratelimit.php';
$user = requireAuth();
xevera_write_rate_limit($pdo, 'profile.delete');
require_once __DIR__ . '/../config/database.php';

$uid = (int)$user['user_id'];
$input = json_decode(file_get_contents('php://input'), true) ?: [];
$confirm = trim((string)($input['confirm'] ?? ''));
$password = trim((string)($input['password'] ?? ''));

if ($confirm !== 'DELETE') {
    http_response_code(400);
    echo json_encode(['error' => 'Type DELETE to confirm account deletion.']);
    exit;
}
if (!$password) {
    http_response_code(400);
    echo json_encode(['error' => 'Password is required.']);
    exit;
}

$stmt = $pdo->prepare('SELECT password_hash FROM users WHERE id = ?');
$stmt->execute([$uid]);
$stored = $stmt->fetchColumn();

if (!password_verify($password, $stored)) {
    http_response_code(403);
    echo json_encode(['error' => 'Incorrect password.']);
    exit;
}

$email = 'deleted_' . $uid . '_' . date('YmdHis') . '@inactive.xevera';
$stmt = $pdo->prepare("UPDATE users SET status = 'Inactive', name = ?, email = ?, username = NULL WHERE id = ?");
$stmt->execute(['Deleted User', $email, $uid]);

$logStmt = $pdo->prepare('INSERT INTO activity_logs (user_id, action, target_type, target_id, detail) VALUES (?, ?, ?, NULL, ?)');
$logStmt->execute([$uid, 'delete_account', 'user', 'Account deactivated']);

echo json_encode(['success' => true]);