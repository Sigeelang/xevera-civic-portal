<?php
header('Content-Type: application/json');
require_once __DIR__ . '/../config/cors.php';

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }
if ($_SERVER['REQUEST_METHOD'] !== 'POST') { http_response_code(405); echo json_encode(['error' => 'Method not allowed']); exit; }

require_once __DIR__ . '/../middleware/auth.php';
$user = requireAuth();

require_once __DIR__ . '/../config/database.php';

$uid = (int)$user['user_id'];
$input = json_decode(file_get_contents('php://input'), true) ?: [];
$current = trim((string)($input['current_password'] ?? ''));
$new = (string)($input['new_password'] ?? '');
$confirm = (string)($input['confirm_password'] ?? '');

if (!$current || !$new || !$confirm) {
    http_response_code(400);
    echo json_encode(['error' => 'All password fields are required.']);
    exit;
}

if ($new !== $confirm) {
    http_response_code(400);
    echo json_encode(['error' => 'New password and confirmation do not match.']);
    exit;
}

if (strlen($new) < 8 || !preg_match('/[A-Z]/', $new) || !preg_match('/[a-z]/', $new)
    || !preg_match('/[0-9]/', $new) || !preg_match('/[^A-Za-z0-9]/', $new)) {
    http_response_code(400);
    echo json_encode(['error' => 'Password must be at least 8 characters and include uppercase, lowercase, a number, and a special character.']);
    exit;
}

$stmt = $pdo->prepare('SELECT password_hash FROM users WHERE id = ?');
$stmt->execute([$uid]);
$stored = $stmt->fetchColumn();

if (!password_verify($current, $stored)) {
    http_response_code(400);
    echo json_encode(['error' => 'Current password is incorrect.']);
    exit;
}

$hash = password_hash($new, PASSWORD_DEFAULT);
$stmt = $pdo->prepare('UPDATE users SET password_hash = ?, must_change_password = 0 WHERE id = ?');
$stmt->execute([$hash, $uid]);

$logStmt = $pdo->prepare('INSERT INTO activity_logs (user_id, action, target_type, target_id, detail) VALUES (?, ?, ?, NULL, ?)');
$logStmt->execute([$uid, 'change_password', 'user', 'Changed password']);

echo json_encode(['success' => true]);