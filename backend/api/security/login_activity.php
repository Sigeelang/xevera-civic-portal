<?php
/**
 * Login activity for the Super Admin Security page.
 * Reads the existing login_history table (written by auth/login.php).
 */
header('Content-Type: application/json');
require_once __DIR__ . '/../config/cors.php';

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }

require_once __DIR__ . '/../middleware/auth.php';
requireRole(['Super Admin', 'Admin']);

require_once __DIR__ . '/../config/database.php';

$page = max(1, (int)($_GET['page'] ?? 1));
$limit = max(1, min(50, (int)($_GET['limit'] ?? 20)));
$search = trim($_GET['search'] ?? '');
$offset = ($page - 1) * $limit;

$where = [];
$params = [];

if ($search) {
    $where[] = '(u.name LIKE ? OR u.username LIKE ? OR u.email LIKE ? OR lh.ip LIKE ?)';
    $like = "%$search%";
    array_push($params, $like, $like, $like, $like);
}

$whereSql = $where ? 'WHERE ' . implode(' AND ', $where) : '';

$countStmt = $pdo->prepare("SELECT COUNT(*) FROM login_history lh LEFT JOIN users u ON lh.user_id = u.id $whereSql");
$countStmt->execute($params);
$total = (int)$countStmt->fetchColumn();
$totalPages = max(1, (int)ceil($total / $limit));

$stmt = $pdo->prepare("
    SELECT lh.id, lh.user_id, lh.browser, lh.os, lh.device, lh.ip, lh.location, lh.created_at,
           u.name AS user_name, u.username AS user_username, u.role AS user_role
    FROM login_history lh
    LEFT JOIN users u ON lh.user_id = u.id
    $whereSql
    ORDER BY lh.created_at DESC
    LIMIT $limit OFFSET $offset
");
$stmt->execute($params);

echo json_encode([
    'items' => $stmt->fetchAll(),
    'total' => $total,
    'page' => $page,
    'total_pages' => $totalPages,
]);
