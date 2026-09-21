<?php
header('Content-Type: application/json');
require_once __DIR__ . '/../config/cors.php';
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../middleware/auth.php';

/*
 * Role permission denials (Super Admin managed).
 *
 * GET  (Staff, Admin, Super Admin): returns the denial list + module
 *      catalog so the frontend can enforce the live matrix.
 * PUT  (Super Admin only): {role: Admin|Staff, module, allowed: bool}
 *      allowed=false inserts a denial, allowed=true deletes it.
 *      {reset: true} clears every denial (restores code behavior).
 *
 * Only Admin/Staff roles are editable. Super Admin always has full
 * access and Resident keeps its code-defined baseline, so neither
 * column can ever be locked out or escalated here.
 */

const PERM_MODULES = [
    'dashboard', 'reports', 'residents', 'announcements', 'maintenance',
    'messages', 'analytics', 'platform-analytics', 'exports', 'tasks',
    'attendance', 'performance', 'activity', 'backup', 'users', 'security',
    'system-settings', 'violations',
];

const PERM_EDITABLE_ROLES = ['Admin', 'Staff'];

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $user = requireAuth();
    $role = $user['role'] ?? '';
    if (!in_array($role, ['Staff', 'Admin', 'Super Admin'], true)) {
        http_response_code(403);
        echo json_encode(['error' => 'Forbidden.']);
        exit;
    }
    $denials = [];
    try {
        foreach ($pdo->query('SELECT role, module FROM role_permission_denials') as $row) {
            $denials[] = ['role' => $row['role'], 'module' => $row['module']];
        }
    } catch (Throwable $e) {
        // Table missing (migration not run yet) = no denials.
        $denials = [];
    }
    echo json_encode(['modules' => PERM_MODULES, 'denials' => $denials]);
    exit;
}

if ($method === 'PUT') {
    $user = requireRole(['Super Admin']);
    $actorId = (int)$user['user_id'];
    $input = json_decode(file_get_contents('php://input'), true) ?: [];

    // Reset everything to code behavior.
    if (!empty($input['reset'])) {
        try {
            $pdo->exec('DELETE FROM role_permission_denials');
        } catch (Throwable $e) {
            http_response_code(500);
            echo json_encode(['error' => 'Could not reset permissions.']);
            exit;
        }
        try {
            $pdo->prepare("INSERT INTO activity_logs (user_id, action, target_type, detail) VALUES (?, 'permissions_reset', 'role', ?)")->execute([$actorId, 'All role permission denials cleared by Super Admin']);
        } catch (Throwable $e) { /* non-fatal */ }
        echo json_encode(['message' => 'Permissions reset to defaults.', 'denials' => []]);
        exit;
    }

    $role = $input['role'] ?? '';
    $module = $input['module'] ?? '';
    $allowed = !empty($input['allowed']);

    if (!in_array($role, PERM_EDITABLE_ROLES, true) || !in_array($module, PERM_MODULES, true)) {
        http_response_code(400);
        echo json_encode(['error' => 'Only Admin/Staff roles and known modules can be changed.']);
        exit;
    }

    try {
        if ($allowed) {
            $pdo->prepare('DELETE FROM role_permission_denials WHERE role = ? AND module = ?')->execute([$role, $module]);
        } else {
            $pdo->prepare('INSERT IGNORE INTO role_permission_denials (role, module, created_by) VALUES (?, ?, ?)')->execute([$role, $module, $actorId]);
        }
    } catch (Throwable $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Could not save permission. Is the migration applied?']);
        exit;
    }

    try {
        $pdo->prepare("INSERT INTO activity_logs (user_id, action, target_type, detail) VALUES (?, ?, 'role', ?)")->execute([$actorId, $allowed ? 'permission_granted' : 'permission_revoked', "$role / $module " . ($allowed ? 'restored' : 'revoked') . ' by Super Admin']);
    } catch (Throwable $e) { /* non-fatal */ }

    $denials = [];
    try {
        foreach ($pdo->query('SELECT role, module FROM role_permission_denials') as $row) {
            $denials[] = ['role' => $row['role'], 'module' => $row['module']];
        }
    } catch (Throwable $e) { /* ignore */ }

    echo json_encode(['message' => 'Permission updated.', 'denials' => $denials]);
    exit;
}

http_response_code(405);
echo json_encode(['error' => 'Method not allowed.']);
