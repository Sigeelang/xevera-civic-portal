<?php
/**
 * Security overview aggregates for the Super Admin Security page.
 * All numbers come from real tables: users, login_history, activity_logs.
 */
header('Content-Type: application/json');
require_once __DIR__ . '/../config/cors.php';

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }

require_once __DIR__ . '/../middleware/auth.php';
requireRole(['Super Admin']);

require_once __DIR__ . '/../config/database.php';

function count_rows(PDO $pdo, string $sql, array $params = []): int {
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    return (int)$stmt->fetchColumn();
}

// User account breakdown.
$accounts = [
    'total' => count_rows($pdo, 'SELECT COUNT(*) FROM users'),
    'active' => count_rows($pdo, "SELECT COUNT(*) FROM users WHERE status = 'Active'"),
    'inactive' => count_rows($pdo, "SELECT COUNT(*) FROM users WHERE status = 'Inactive'"),
    'super_admins' => count_rows($pdo, "SELECT COUNT(*) FROM users WHERE role = 'Super Admin' AND status = 'Active'"),
    'admins' => count_rows($pdo, "SELECT COUNT(*) FROM users WHERE role = 'Admin' AND status = 'Active'"),
    'staff' => count_rows($pdo, "SELECT COUNT(*) FROM users WHERE role = 'Staff' AND status = 'Active'"),
    'residents' => count_rows($pdo, "SELECT COUNT(*) FROM users WHERE role = 'Resident' AND status = 'Active'"),
];

// Login activity.
$stats = [
    'logins_7d' => count_rows($pdo, 'SELECT COUNT(DISTINCT user_id) FROM login_history WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)'),
    'logins_30d' => count_rows($pdo, 'SELECT COUNT(DISTINCT user_id) FROM login_history WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)'),
    'failed_logins_total' => count_rows($pdo, "SELECT COUNT(*) FROM activity_logs WHERE action = 'login_failed'"),
    'failed_logins_7d' => count_rows($pdo, "SELECT COUNT(*) FROM activity_logs WHERE action = 'login_failed' AND created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)"),
];

// Recent security events from activity_logs.
$stmt = $pdo->prepare("
    SELECT al.id, al.action, al.detail, al.ip_address AS ip, al.created_at,
           u.name AS user_name
    FROM activity_logs al
    LEFT JOIN users u ON al.user_id = u.id
    WHERE al.action IN ('login_failed', 'login', 'logout', 'toggle_user', 'delete_user', 'update_settings', 'restore_backup', 'create_backup')
    ORDER BY al.created_at DESC
    LIMIT 10
");
$stmt->execute();
$recent_events = $stmt->fetchAll();

echo json_encode([
    'accounts' => $accounts,
    'stats' => $stats,
    'recent_events' => $recent_events,
]);
