<?php
header('Content-Type: application/json');
require_once __DIR__ . '/../config/cors.php';

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }
if ($_SERVER['REQUEST_METHOD'] !== 'GET') { http_response_code(405); echo json_encode(['error' => 'Method not allowed']); exit; }

require_once __DIR__ . '/../middleware/auth.php';
$currentUser = requireRole(['Staff', 'Admin', 'Super Admin', 'Resident']);

require_once __DIR__ . '/../config/database.php';

/*
 * Messageable users for the New Message composer.
 * Staff may only message managers (Admin/Super Admin).
 * Residents may message management (Admin/Super Admin) only.
 * Admin/Super Admin can message other personnel and residents.
 */
$requesterRole = $currentUser['role'] ?? '';
if ($requesterRole === 'Resident') {
    /* Residents may only message management. */
    $roles = ['Admin', 'Super Admin'];
} elseif ($requesterRole === 'Staff') {
    /* Staff may only message managers. */
    $roles = ['Admin', 'Super Admin'];
} else {
    /* Admin/Super Admin may message personnel AND residents. */
    $roles = ['Staff', 'Admin', 'Super Admin', 'Resident'];
}

$placeholders = implode(',', array_fill(0, count($roles), '?'));
$stmt = $pdo->prepare("SELECT id, name, role FROM users WHERE role IN ($placeholders) AND status = 'Active' AND id <> ? ORDER BY FIELD(role, 'Super Admin', 'Admin', 'Staff', 'Resident'), name ASC");
$stmt->execute(array_merge($roles, [(int)$currentUser['user_id']]));
$rows = $stmt->fetchAll();

echo json_encode(array_map(function ($u) {
    return [
        'id' => (int)$u['id'],
        'name' => $u['name'],
        'role' => $u['role'],
    ];
}, $rows));
