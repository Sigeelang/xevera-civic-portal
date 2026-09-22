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
requirePermission('analytics', ['Super Admin', 'Admin']);

require_once __DIR__ . '/../config/database.php';

/*
 * Date range: ?range=7d|30d|90d|year or custom ?from=YYYY-MM-DD&to=YYYY-MM-DD.
 * Growth series bucket daily (weekly when the span exceeds 92 days).
 * Deltas compare the selected span against the immediately preceding span.
 */
$range = $_GET['range'] ?? '30d';
$fromParam = trim($_GET['from'] ?? '');
$toParam = trim($_GET['to'] ?? '');

date_default_timezone_set('Asia/Manila');
$end = new DateTime('today');
$end->setTime(23, 59, 59);

if ($fromParam !== '' && $toParam !== '' && preg_match('/^\d{4}-\d{2}-\d{2}$/', $fromParam) && preg_match('/^\d{4}-\d{2}-\d{2}$/', $toParam)) {
    $start = new DateTime($fromParam . ' 00:00:00');
    $end = new DateTime($toParam . ' 23:59:59');
    if ($end < $start) { $tmp = $start; $start = $end; $end = $tmp; }
    $days = max(1, (int)$start->diff($end)->days + 1);
    $rangeKey = 'custom';
} else {
    $map = ['7d' => 7, '30d' => 30, '90d' => 90, 'year' => 365];
    $days = $map[$range] ?? 30;
    $rangeKey = isset($map[$range]) ? $range : '30d';
    $start = (clone $end)->modify('-' . ($days - 1) . ' days')->setTime(0, 0, 0);
}

$startStr = $start->format('Y-m-d H:i:s');
$endStr = $end->format('Y-m-d H:i:s');
$spanDays = max(1, (int)$start->diff($end)->days + 1);
$prevStartStr = (clone $start)->modify("-$spanDays days")->format('Y-m-d H:i:s');
$prevEndStr = $start->format('Y-m-d H:i:s');
$weekly = $spanDays > 92;

function xanalytics_pct($cur, $prev) {
    $cur = (int)$cur; $prev = (int)$prev;
    if ($prev <= 0) return $cur > 0 ? 100.0 : 0.0;
    return round((($cur - $prev) / $prev) * 100, 1);
}

/* Build zero-filled daily buckets, then fold query rows into them. */
function xanalytics_buckets(DateTime $start, int $spanDays, bool $weekly): array {
    $buckets = [];
    if ($weekly) {
        $cursor = clone $start;
        while ($cursor <= new DateTime()) {
            $key = $cursor->format('Y-m-d');
            $buckets[$key] = ['date' => $cursor->format('M j'), 'count' => 0];
            $cursor->modify('+7 days');
            if (count($buckets) > 60) break;
        }
        return [$buckets, true];
    }
    for ($i = 0; $i < $spanDays; $i++) {
        $d = (clone $start)->modify("+$i days");
        $buckets[$d->format('Y-m-d')] = ['date' => $d->format('M j'), 'count' => 0];
    }
    return [$buckets, false];
}

function xanalytics_fold(array &$buckets, bool $weekly, DateTime $start, string $rowDate, int $count, string $field = 'count'): void {
    try {
        $d = new DateTime($rowDate);
    } catch (Exception $e) {
        return;
    }
    if ($weekly) {
        $diff = (int)$start->diff($d)->days;
        if ($diff < 0) return;
        $weekStart = (clone $start)->modify('+' . (intdiv($diff, 7) * 7) . ' days')->format('Y-m-d');
        if (isset($buckets[$weekStart])) $buckets[$weekStart][$field] += $count;
        return;
    }
    $key = $d->format('Y-m-d');
    if (isset($buckets[$key])) $buckets[$key][$field] += $count;
}

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

// User growth (range buckets by day)
list($userBuckets, $userWeekly) = xanalytics_buckets($start, $spanDays, $weekly);
$stmt = $pdo->prepare("SELECT DATE(created_at) AS d, COUNT(*) AS c FROM users WHERE created_at >= ? AND created_at <= ? GROUP BY DATE(created_at)");
$stmt->execute([$startStr, $endStr]);
foreach ($stmt->fetchAll() as $row) xanalytics_fold($userBuckets, $userWeekly, $start, $row['d'], (int)$row['c']);
$userGrowth = array_values($userBuckets);

// --- Report stats ---
$totalReports = (int)$pdo->query('SELECT COUNT(*) FROM reports')->fetchColumn();
$reportsByStatus = [];
$stmt = $pdo->query('SELECT status, COUNT(*) AS c FROM reports GROUP BY status');
foreach ($stmt->fetchAll() as $r) {
    $key = $r['status'] === 'Claimed' ? 'In Progress' : $r['status'];
    $reportsByStatus[$key] = (int)$r['c'];
}

// Workflow buckets: Pending / Under Review / In Progress / Resolved.
// Under Review = flagged suspicious with no linked violation yet.
$underReviewCount = 0;
try {
    $underReviewCount = (int)$pdo->query("SELECT COUNT(*) FROM reports r LEFT JOIN violations v ON v.report_id = r.id WHERE r.is_suspicious = 1 AND v.id IS NULL")->fetchColumn();
} catch (PDOException $e) { $underReviewCount = 0; }
$pendingRaw = (int)($reportsByStatus['Pending'] ?? 0);
$workflow = [
    'Pending' => max(0, $pendingRaw - $underReviewCount),
    'Under Review' => $underReviewCount,
    'In Progress' => (int)($reportsByStatus['In Progress'] ?? 0),
    'Resolved' => (int)($reportsByStatus['Resolved'] ?? 0),
];

$reportsByCategory = [];
$stmt = $pdo->query('SELECT category, COUNT(*) AS c FROM reports GROUP BY category ORDER BY c DESC');
foreach ($stmt->fetchAll() as $r) $reportsByCategory[] = ['category' => $r['category'], 'count' => (int)$r['c']];

$reportsToday = (int)$pdo->query("SELECT COUNT(*) FROM reports WHERE DATE(created_at) = CURDATE()")->fetchColumn();
$reportsWeek = (int)$pdo->query("SELECT COUNT(*) FROM reports WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)")->fetchColumn();
$reportsMonth = (int)$pdo->query("SELECT COUNT(*) FROM reports WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)")->fetchColumn();

$urgentOpen = (int)$pdo->query("SELECT COUNT(*) FROM reports WHERE priority = 'Urgent' AND status IN ('Pending','Verified','Assigned','In Progress')")->fetchColumn();

// Report growth (range buckets)
list($reportBuckets, $reportWeekly) = xanalytics_buckets($start, $spanDays, $weekly);
$stmt = $pdo->prepare("SELECT DATE(created_at) AS d, COUNT(*) AS c FROM reports WHERE created_at >= ? AND created_at <= ? GROUP BY DATE(created_at)");
$stmt->execute([$startStr, $endStr]);
foreach ($stmt->fetchAll() as $row) xanalytics_fold($reportBuckets, $reportWeekly, $start, $row['d'], (int)$row['c']);
$reportGrowth = array_values($reportBuckets);

// Range counts + previous-span counts for deltas.
$stmt = $pdo->prepare('SELECT COUNT(*) FROM reports WHERE created_at >= ? AND created_at <= ?');
$stmt->execute([$startStr, $endStr]);
$reportsInRange = (int)$stmt->fetchColumn();
$stmt = $pdo->prepare('SELECT COUNT(*) FROM reports WHERE created_at >= ? AND created_at < ?');
$stmt->execute([$prevStartStr, $prevEndStr]);
$reportsPrev = (int)$stmt->fetchColumn();

$stmt = $pdo->prepare('SELECT COUNT(*) FROM users WHERE created_at >= ? AND created_at <= ?');
$stmt->execute([$startStr, $endStr]);
$usersInRange = (int)$stmt->fetchColumn();
$stmt = $pdo->prepare('SELECT COUNT(*) FROM users WHERE created_at >= ? AND created_at < ?');
$stmt->execute([$prevStartStr, $prevEndStr]);
$usersPrev = (int)$stmt->fetchColumn();

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

// Recent system activity (no IP addresses — resident privacy).
$recentActivity = [];
try {
    $stmt = $pdo->prepare("
        SELECT al.action, al.target_type, al.detail, al.created_at, u.name AS user_name, u.role AS user_role
        FROM activity_logs al
        LEFT JOIN users u ON al.user_id = u.id
        ORDER BY al.created_at DESC
        LIMIT 20
    ");
    $stmt->execute();
    foreach ($stmt->fetchAll() as $r) {
        $recentActivity[] = [
            'action' => $r['action'],
            'target' => $r['target_type'],
            'detail' => $r['detail'],
            'date' => $r['created_at'],
            'user' => $r['user_name'] ?? 'System',
            'role' => $r['user_role'] ?? '',
        ];
    }
} catch (PDOException $e) { $recentActivity = []; }

// --- Email / OTP stats ---
$totalOtpSent = (int)$pdo->query("SELECT COUNT(*) FROM activity_logs WHERE action IN ('2fa_otp_sent','otp_sent')")->fetchColumn();
$otpThisWeek = (int)$pdo->query("SELECT COUNT(*) FROM activity_logs WHERE action IN ('2fa_otp_sent','otp_sent') AND created_at >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)")->fetchColumn();

// --- Citizen satisfaction: resident Like/Dislike on RESOLVED reports only ---
// Authoritative source is the per-user reaction tables (one row per
// resident per report), joined to resolved reports — never the
// denormalized counters (which predate enforced reactions).
$satLikes = 0; $satDislikes = 0;
try {
    $satLikes = (int)$pdo->query("SELECT COUNT(*) FROM report_likes l JOIN reports r ON l.report_id = r.id WHERE r.status = 'Resolved'")->fetchColumn();
} catch (PDOException $e) { $satLikes = 0; }
try {
    $satDislikes = (int)$pdo->query("SELECT COUNT(*) FROM report_dislikes l JOIN reports r ON l.report_id = r.id WHERE r.status = 'Resolved'")->fetchColumn();
} catch (PDOException $e) {
    // Pre-dislikes migration: fall back to the counter column.
    try {
        $satDislikes = (int)$pdo->query("SELECT COALESCE(SUM(dislikes),0) FROM reports WHERE status = 'Resolved'")->fetchColumn();
    } catch (PDOException $e2) { $satDislikes = 0; }
}
$satTotal = $satLikes + $satDislikes;
$satRate = $satTotal > 0 ? round(($satLikes / $satTotal) * 100, 1) : 0;

// Satisfaction trend across the range (reaction dates, resolved reports).
$satTrendSeed = [];
foreach (array_keys($reportBuckets) as $k) {
    $satTrendSeed[$k] = ['date' => $reportBuckets[$k]['date'], 'likes' => 0, 'dislikes' => 0];
}
try {
    $stmt = $pdo->prepare("SELECT DATE(l.created_at) AS d, COUNT(*) AS c FROM report_likes l JOIN reports r ON l.report_id = r.id WHERE r.status = 'Resolved' AND l.created_at >= ? AND l.created_at <= ? GROUP BY DATE(l.created_at)");
    $stmt->execute([$startStr, $endStr]);
    foreach ($stmt->fetchAll() as $row) xanalytics_fold($satTrendSeed, $reportWeekly, $start, $row['d'], (int)$row['c'], 'likes');
} catch (PDOException $e) { /* no data */ }
try {
    $stmt = $pdo->prepare("SELECT DATE(l.created_at) AS d, COUNT(*) AS c FROM report_dislikes l JOIN reports r ON l.report_id = r.id WHERE r.status = 'Resolved' AND l.created_at >= ? AND l.created_at <= ? GROUP BY DATE(l.created_at)");
    $stmt->execute([$startStr, $endStr]);
    foreach ($stmt->fetchAll() as $row) xanalytics_fold($satTrendSeed, $reportWeekly, $start, $row['d'], (int)$row['c'], 'dislikes');
} catch (PDOException $e) { /* pre-migration */ }

// Recent resident feedback (resolved reports only, no resident PII).
$recentFeedback = [];
try {
    $stmt = $pdo->prepare("
        SELECT f.rating, f.comment, f.created_at, r.ref_id, r.category
        FROM feedback f
        JOIN reports r ON f.report_id = r.id
        WHERE r.status = 'Resolved'
        ORDER BY f.created_at DESC
        LIMIT 10
    ");
    $stmt->execute();
    foreach ($stmt->fetchAll() as $r) {
        $recentFeedback[] = [
            'rating' => $r['rating'],
            'comment' => $r['comment'],
            'date' => $r['created_at'],
            'ref_id' => $r['ref_id'],
            'category' => $r['category'],
        ];
    }
} catch (PDOException $e) { $recentFeedback = []; }

// --- Service requests ---
$srTotal = 0; $srByStatus = []; $srTrend = [];
try {
    $srTotal = (int)$pdo->query('SELECT COUNT(*) FROM service_requests')->fetchColumn();
    $stmt = $pdo->query('SELECT status, COUNT(*) AS c FROM service_requests GROUP BY status');
    foreach ($stmt->fetchAll() as $r) $srByStatus[$r['status']] = (int)$r['c'];
    list($srBuckets, $srWeekly) = xanalytics_buckets($start, $spanDays, $weekly);
    $stmt = $pdo->prepare("SELECT DATE(created_at) AS d, COUNT(*) AS c FROM service_requests WHERE created_at >= ? AND created_at <= ? GROUP BY DATE(created_at)");
    $stmt->execute([$startStr, $endStr]);
    foreach ($stmt->fetchAll() as $row) xanalytics_fold($srBuckets, $srWeekly, $start, $row['d'], (int)$row['c']);
    $srTrend = array_values($srBuckets);
} catch (PDOException $e) { /* table missing */ }

// --- Violations (Fake Report system, no monetary penalties) ---
$violTotal = 0; $violByStatus = []; $violUnderReview = 0; $violConfirmed = 0; $violActive = 0;
try {
    $violTotal = (int)$pdo->query('SELECT COUNT(*) FROM violations')->fetchColumn();
    $stmt = $pdo->query('SELECT status, COUNT(*) AS c FROM violations GROUP BY status');
    foreach ($stmt->fetchAll() as $r) $violByStatus[$r['status']] = (int)$r['c'];
    $violUnderReview = (int)$pdo->query("SELECT COUNT(*) FROM reports r LEFT JOIN violations v ON v.report_id = r.id WHERE r.is_suspicious = 1 AND v.id IS NULL")->fetchColumn();
    $violConfirmed = (int)$pdo->query("SELECT COUNT(*) FROM violations WHERE status = 'Confirmed'")->fetchColumn();
    $violActive = (int)$pdo->query("SELECT COUNT(*) FROM violations WHERE status = 'Confirmed' AND penalty_type IS NOT NULL AND penalty_type != 'Warning'")->fetchColumn();
} catch (PDOException $e) { /* tables missing */ }

// --- System health ---
$dbStatus = 'connected';
try { $pdo->query('SELECT 1'); } catch (Exception $e) { $dbStatus = 'error'; }

$phpVersion = phpversion();
$serverTime = date('Y-m-d H:i:s');

echo json_encode([
    'range' => [
        'key' => $rangeKey,
        'from' => $start->format('Y-m-d'),
        'to' => (new DateTime($endStr))->format('Y-m-d'),
        'days' => $spanDays,
        'weekly_buckets' => $weekly,
    ],
    'deltas' => [
        'users_pct' => xanalytics_pct($usersInRange, $usersPrev),
        'reports_pct' => xanalytics_pct($reportsInRange, $reportsPrev),
    ],
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
        'by_workflow' => $workflow,
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
    'satisfaction' => [
        'likes' => $satLikes,
        'dislikes' => $satDislikes,
        'total' => $satTotal,
        'rate' => $satRate,
        'trend' => array_values($satTrendSeed),
        'recent' => $recentFeedback,
    ],
    'services' => [
        'total' => $srTotal,
        'by_status' => $srByStatus,
        'trend' => $srTrend,
    ],
    'violations' => [
        'total' => $violTotal,
        'by_status' => $violByStatus,
        'under_review' => $violUnderReview,
        'confirmed' => $violConfirmed,
        'active_penalties' => $violActive,
    ],
    'activity' => $recentActivity,
    'system' => [
        'database' => $dbStatus,
        'php_version' => $phpVersion,
        'server_time' => $serverTime,
    ],
]);
