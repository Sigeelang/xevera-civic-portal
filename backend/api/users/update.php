<?php
header('Content-Type: application/json');
require_once __DIR__ . '/../config/cors.php';

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

require_once __DIR__ . '/../middleware/auth.php';
require_once __DIR__ . '/../middleware/write_ratelimit.php';
$currentUser = requireRole(['Super Admin']);
xevera_write_rate_limit($pdo, 'users.update');

require_once __DIR__ . '/../config/database.php';

$input = json_decode(file_get_contents('php://input'), true);
$id = (int)($input['id'] ?? 0);
$name = isset($input['name']) ? trim($input['name']) : null;
$email = isset($input['email']) ? trim($input['email']) : null;
$role = isset($input['role']) ? trim($input['role']) : null;
$password = isset($input['password']) ? $input['password'] : null;

if (!$id) {
    http_response_code(400);
    echo json_encode(['error' => 'User ID is required.']);
    exit;
}

$stmt = $pdo->prepare('SELECT id, name, username, email, role, status FROM users WHERE id = ?');
$stmt->execute([$id]);
$user = $stmt->fetch();

if (!$user) {
    http_response_code(404);
    echo json_encode(['error' => 'User not found.']);
    exit;
}

$validRoles = ['Super Admin', 'Admin', 'Staff'];
if ($role !== null && !in_array($role, $validRoles)) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid role.']);
    exit;
}

$updates = [];
$params = [];

if ($name !== null && $name !== '') {
    if (strlen($name) > 120) {
        http_response_code(400);
        echo json_encode(['error' => 'Name is too long.']);
        exit;
    }
    $updates[] = 'name = ?';
    $params[] = $name;
}

if ($email !== null) {
    if ($email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
        http_response_code(400);
        echo json_encode(['error' => 'A valid email is required.']);
        exit;
    }
    $stmt = $pdo->prepare('SELECT id FROM users WHERE email = ? AND id != ?');
    $stmt->execute([$email, $id]);
    if ($stmt->fetch()) {
        http_response_code(409);
        echo json_encode(['error' => 'Email already exists.']);
        exit;
    }
    $updates[] = 'email = ?';
    $params[] = $email;
}

if ($role !== null && $role !== $user['role']) {
    if ($user['role'] === 'Super Admin' && $role !== 'Super Admin') {
        $cnt = (int)$pdo->query('SELECT COUNT(*) FROM users WHERE role = "Super Admin" AND status = "Active"')->fetchColumn();
        if ($cnt <= 1) {
            http_response_code(400);
            echo json_encode(['error' => 'Cannot demote the last active Super Admin.']);
            exit;
        }
    }
    $updates[] = 'role = ?';
    $params[] = $role;
}

if ($password !== null && $password !== '') {
    if (strlen($password) < 8) {
        http_response_code(400);
        echo json_encode(['error' => 'Password must be at least 8 characters.']);
        exit;
    }
    $updates[] = 'password_hash = ?';
    $params[] = password_hash($password, PASSWORD_DEFAULT);
}

if (empty($updates)) {
    echo json_encode(['message' => 'No changes were made.']);
    exit;
}

$params[] = $id;
$stmt = $pdo->prepare('UPDATE users SET ' . implode(', ', $updates) . ' WHERE id = ?');
$stmt->execute($params);

$logStmt = $pdo->prepare('INSERT INTO activity_logs (user_id, action, target_type, target_id, detail) VALUES (?, ?, ?, ?, ?)');
$logStmt->execute([$currentUser['user_id'], 'update_user', 'user', $id, 'Updated user: ' . ($name ?? $user['name'])]);

echo json_encode(['message' => 'User updated successfully.']);