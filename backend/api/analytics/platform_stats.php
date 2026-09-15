<?php
header('Content-Type: application/json');
require_once __DIR__ . '/../config/cors.php';

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

require_once __DIR__ . '/../middleware/auth.php';
requireRole(['Super Admin', 'Admin']);

require_once __DIR__ . '/../config/database.php';

// --- User stats ---
$totalUsers = (int)$pdo->query('SELECT COUNT(*) FROM users')->fetchColumn();
$usersByRole = [];
$stmt = $pdo->query('SELECT role, COUNT(*) AS c FROM users GROUP BY role');
foreach ($stmt->fetchAll() as $r) $usersByRole[$r['role']] = (int)$r['c'];

$activeUsers = (int)$pdo->query("SELECT COUNT(*) FROM users WHERE status = 'Active'")->fetchColumn();
$inactiveUsers = $totalUsers - $activeUsers;

$newUsersToday = (int)$pdo->query("SELECT COUNT(*) FROM users WHERE DATE(created_at) = CURDATE()")->fetchColumn();
$newUsersWeek = (int)$pdo->query("SELECT COUNT(*) FROM users WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)")->fetchColumn();
$newUsersMonth = (int)$pdo->query("SELECT COUNT(*) FROM users WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)")->fetchColumn();

// User growth (last 30 days by day)
$userGrowth = [];
$growthStart = (new DateTime())->modify('-29 days')->setTime(0, 0);
for ($i = 0; $i < 30; $i++) {
    $d = (clone $growthStart)->modify("+$i days");
    $userGrowth[] = ['date' => $d->format('M j'), 'count' => 0];
}
$stmt = $pdo->prepare("SELECT DATE(created_at) AS d, COUNT(*) AS c FROM users WHERE created_at >= ? GROUP BY DATE(created_at)");
$stmt->execute([$growthStart->format('Y-m-d 00:00:00')]);
foreach ($stmt->fetchAll() as $row) {
    $idx = (int)$growthStart->diff(new DateTime($row['d']))->days;
    if ($idx >= 0 && $idx < 30) $userGrowth[$idx]['count'] = (int)$row['c'];
}

// --- Report stats ---
$totalReports = (int)$pdo->query('SELECT COUNT(*) FROM reports')->fetchColumn();
$reportsByStatus = [];
$stmt = $pdo->query('SELECT status, COUNT(*) AS c FROM reports GROUP BY status');
foreach ($stmt->fetchAll() as $r) {
    $key = $r['status'] === 'Claimed' ? 'In Progress' : $r['status'];
    $reportsByStatus[$key] = (int)$r['c'];
}

$reportsByCategory = [];
$stmt = $pdo->query('SELECT category, COUNT(*) AS c FROM reports GROUP BY category ORDER BY c DESC');
foreach ($stmt->fetchAll() as $r) $reportsByCategory[] = ['category' => $r['category'], 'count' => (int)$r['c']];

$reportsToday = (int)$pdo->query("SELECT COUNT(*) FROM reports WHERE DATE(created_at) = CURDATE()")->fetchColumn();
$reportsWeek = (int)$pdo->query("SELECT COUNT(*) FROM reports WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)")->fetchColumn();
$reportsMonth = (int)$pdo->query("SELECT COUNT(*) FROM reports WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)")->fetchColumn();

$urgentOpen = (int)$pdo->query("SELECT COUNT(*) FROM reports WHERE priority = 'Urgent' AND status IN ('Pending','Verified','Assigned','In Progress')")->fetchColumn();

// Report growth (last 30 days by day)
$reportGrowth = [];
$rGrowthStart = (new DateTime())->modify('-29 days')->setTime(0, 0);
for ($i = 0; $i < 30; $i++) {
    $d = (clone $rGrowthStart)->modify("+$i days");
    $reportGrowth[] = ['date' => $d->format('M j'), 'count' => 0];
}
$stmt = $pdo->prepare("SELECT DATE(created_at) AS d, COUNT(*) AS c FROM reports WHERE created_at >= ? GROUP BY DATE(created_at)");
$stmt->execute([$rGrowthStart->format('Y-m-d 00:00:00')]);
foreach ($stmt->fetchAll() as $row) {
    $idx = (int)$rGrowthStart->diff(new DateTime($row['d']))->days;
    if ($idx >= 0 && $idx < 30) $reportGrowth[$idx]['count'] = (int)$row['c'];
}

// --- Login / Activity stats ---
$totalLogins = (int)$pdo->query("SELECT COUNT(*) FROM activity_logs WHERE action = 'login'")->fetchColumn();
$loginsToday = (int)$pdo->query("SELECT COUNT(*) FROM activity_logs WHERE action = 'login' AND DATE(created_at) = CURDATE()")->fetchColumn();
$loginsWeek = (int)$pdo->query("SELECT COUNT(*) FROM activity_logs WHERE action = 'login' AND created_at >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)")->fetchColumn();

$failedLogins = (int)$pdo->query("SELECT COUNT(*) FROM activity_logs WHERE action = 'login_failed'")->fetchColumn();
$failedLoginsWeek = (int)$pdo->query("SELECT COUNT(*) FROM activity_logs WHERE action = 'login_failed' AND created_at >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)")->fetchColumn();

$activeSessions = (int)$pdo->query("SELECT COUNT(DISTINCT user_id) FROM activity_logs WHERE action = 'login' AND created_at >= DATE_SUB(NOW(), INTERVAL 15 MINUTE)")->fetchColumn();

// Login frequency (last 7 days by day)
$loginWeek = [];
$lWeekStart = (new DateTime())->modify('-6 days')->setTime(0, 0);
for ($i = 0; $i < 7; $i++) {
    $d = (clone $lWeekStart)->modify("+$i days");
    $loginWeek[] = ['day' => $d->format('D'), 'date' => $d->format('M j'), 'logins' => 0, 'failed' => 0];
}
$stmt = $pdo->prepare("SELECT DATE(created_at) AS d, action, COUNT(*) AS c FROM activity_logs WHERE action IN ('login','login_failed') AND created_at >= ? GROUP BY DATE(created_at), action");
$stmt->execute([$lWeekStart->format('Y-m-d 00:00:00')]);
foreach ($stmt->fetchAll() as $row) {
    $idx = (int)$lWeekStart->diff(new DateTime($row['d']))->days;
    if ($idx >= 0 && $idx < 7) {
        if ($row['action'] === 'login') $loginWeek[$idx]['logins'] = (int)$row['c'];
        else $loginWeek[$idx]['failed'] = (int)$row['c'];
    }
}

// Top active users (last 7 days)
$stmt = $pdo->prepare("
    SELECT u.name, u.role, COUNT(*) AS login_count
    FROM activity_logs al
    JOIN users u ON al.user_id = u.id
    WHERE al.action = 'login' AND al.created_at >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
    GROUP BY al.user_id, u.name, u.role
    ORDER BY login_count DESC
    LIMIT 10
");
$stmt->execute();
$topUsers = $stmt->fetchAll();

// --- Email / OTP stats ---
$totalOtpSent = (int)$pdo->query("SELECT COUNT(*) FROM activity_logs WHERE action IN ('2fa_otp_sent','otp_sent')")->fetchColumn();
$otpThisWeek = (int)$pdo->query("SELECT COUNT(*) FROM activity_logs WHERE action IN ('2fa_otp_sent','otp_sent') AND created_at >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)")->fetchColumn();

// --- System health ---
$dbStatus = 'connected';
try { $pdo->query('SELECT 1'); } catch (Exception $e) { $dbStatus = 'error'; }

$phpVersion = phpversion();
$serverTime = date('Y-m-d H:i:s');

echo json_encode([
    'users' => [
        'total' => $totalUsers,
        'active' => $activeUsers,
        'inactive' => $inactiveUsers,
        'by_role' => $usersByRole,
        'new_today' => $newUsersToday,
        'new_week' => $newUsersWeek,
        'new_month' => $newUsersMonth,
        'growth' => $userGrowth,
    ],
    'reports' => [
        'total' => $totalReports,
        'by_status' => $reportsByStatus,
        'by_category' => $reportsByCategory,
        'today' => $reportsToday,
        'this_week' => $reportsWeek,
        'this_month' => $reportsMonth,
        'urgent_open' => $urgentOpen,
        'growth' => $reportGrowth,
    ],
    'logins' => [
        'total' => $totalLogins,
        'today' => $loginsToday,
        'this_week' => $loginsWeek,
        'failed_total' => $failedLogins,
        'failed_week' => $failedLoginsWeek,
        'active_now' => $activeSessions,
        'week' => $loginWeek,
        'top_users' => $topUsers,
    ],
    'email' => [
        'otp_sent_total' => $totalOtpSent,
        'otp_sent_week' => $otpThisWeek,
    ],
    'system' => [
        'database' => $dbStatus,
        'php_version' => $phpVersion,
        'server_time' => $serverTime,
    ],
]);
