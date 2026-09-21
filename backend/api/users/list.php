<?php
header('Content-Type: application/json');
require_once __DIR__ . '/../config/cors.php';

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once __DIR__ . '/../middleware/auth.php';
requirePermission('users', ['Super Admin']);

require_once __DIR__ . '/../config/database.php';

$q = trim($_GET['search'] ?? '');
$role = trim($_GET['role'] ?? '');
$status = trim($_GET['status'] ?? '');

// "staff-admins" is a combined view of Staff + Admin accounts.
$roleMap = [
    'staff' => ['Staff'],
    'administrator' => ['Admin'],
    'administrators' => ['Admin'],
    'admin' => ['Admin'],
    'resident' => ['Resident'],
    'residents' => ['Resident'],
    'super_admin' => ['Super Admin'],
    'staff-admins' => ['Staff', 'Admin'],
];

$sql = 'SELECT id, name, username, email, role, status, created_at, last_login_at FROM users';
$where = [];
$params = [];

$roles = $roleMap[strtolower($role)] ?? null;
if ($roles) {
    $placeholders = implode(',', array_fill(0, count($roles), '?'));
    $where[] = "role IN ($placeholders)";
    foreach ($roles as $r) { $params[] = $r; }
}

if (in_array($status, ['Active', 'Inactive'], true)) {
    $where[] = 'status = ?';
    $params[] = $status;
}

if ($q) {
    $where[] = '(name LIKE ? OR username LIKE ? OR email LIKE ?)';
    $params[] = "%$q%";
    $params[] = "%$q%";
    $params[] = "%$q%";
}

if ($where) {
    $sql .= ' WHERE ' . implode(' AND ', $where);
}

$sql .= ' ORDER BY name ASC';
$stmt = $pdo->prepare($sql);
$stmt->execute($params);
$users = $stmt->fetchAll();

echo json_encode(array_map(function ($u) {
    return [
        'id' => (int)$u['id'],
        'name' => $u['name'],
        'username' => $u['username'],
        'email' => $u['email'],
        'role' => $u['role'],
        'status' => $u['status'],
        'created_at' => $u['created_at'],
        'last_login_at' => $u['last_login_at'],
    ];
}, $users));
