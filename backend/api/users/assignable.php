<?php
header('Content-Type: application/json');
require_once __DIR__ . '/../config/cors.php';

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once __DIR__ . '/../middleware/auth.php';
requireRole(['Staff', 'Admin', 'Super Admin']);

require_once __DIR__ . '/../config/database.php';

$stmt = $pdo->prepare("SELECT id, name, role FROM users WHERE role IN ('Staff', 'Admin', 'Super Admin') AND status = 'Active' ORDER BY name ASC");
$stmt->execute();
$staff = $stmt->fetchAll();

echo json_encode(array_map(function ($u) {
    return [
        'id' => (int)$u['id'],
        'name' => $u['name'],
        'role' => $u['role'],
    ];
}, $staff));
