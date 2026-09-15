<?php
header('Content-Type: application/json');
require_once __DIR__ . '/../config/cors.php';

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../middleware/token.php';

$payload = token_payload();

// Optional per-staff scope: /reports/stats.php?assigned_to=me (requires valid token)
$scopeMe = ($_GET['assigned_to'] ?? '') === 'me' && $payload && isset($payload['user_id']);
$me = $scopeMe ? (int)$payload['user_id'] : null;

$meWhere = $me ? ' AND assigned_to = ' . $me : '';

/*
 * Optional "hide mine": drop reports where the viewer is the assignee or
 * the original reporter, so the KPI cards match the All Reports list when
 * the "Hide mine" filter is on. Requires a valid token.
 */
$hideMine = ($_GET['hide_mine'] ?? '') === 'true' && $payload && isset($payload['user_id']);
$hideUid = $hideMine ? (int)$payload['user_id'] : 0;
if ($hideUid) {
    $meWhere .= " AND NOT (assigned_to = $hideUid OR reporter_user_id = $hideUid)";
}

function countWhere(PDO $pdo, string $status, string $extra = '') {
    $sql = "SELECT COUNT(*) FROM reports WHERE status = ?$extra";
    $stmt = $pdo->prepare($sql);
    $stmt->execute([$status]);
    return (int)$stmt->fetchColumn();
}

$totalWhere = ($me ? ' WHERE assigned_to = ' . $me : '');
if ($hideUid) {
    $totalWhere = $totalWhere === ''
        ? " WHERE NOT (assigned_to = $hideUid OR reporter_user_id = $hideUid)"
        : $totalWhere . " AND NOT (assigned_to = $hideUid OR reporter_user_id = $hideUid)";
}
$total = (int)$pdo->query('SELECT COUNT(*) FROM reports' . $totalWhere)->fetchColumn();
$pending = countWhere($pdo, 'Pending', $meWhere);
$verified = countWhere($pdo, 'Verified', $meWhere);
$assignedCount = countWhere($pdo, 'Assigned', $meWhere);
$inProgress = countWhere($pdo, 'In Progress', $meWhere);
$claimed = $inProgress; // legacy alias
$resolved = countWhere($pdo, 'Resolved', $meWhere);
$closed = countWhere($pdo, 'Closed', $meWhere);
$rejected = countWhere($pdo, 'Rejected', $meWhere);

$open = $pending + $verified + $assignedCount + $inProgress;

// Resolved this calendar month (by resolved_at when available, else updated_at)
$monthSql = "SELECT COUNT(*) FROM reports WHERE status = 'Resolved' AND (resolved_at IS NOT NULL OR updated_at IS NOT NULL)" .
    " AND COALESCE(resolved_at, updated_at) >= ?$meWhere";
$stmt = $pdo->prepare($monthSql);
$stmt->execute([date('Y-m-01 00:00:00')]);
$resolvedThisMonth = (int)$stmt->fetchColumn();

// Urgent open reports
$stmt = $pdo->prepare("SELECT COUNT(*) FROM reports WHERE priority = 'Urgent' AND status IN ('Pending','Verified','Assigned','In Progress')$meWhere");
$stmt->execute();
$urgentOpen = (int)$stmt->fetchColumn();

// Due today = open work currently assigned to the staff member
$stmt = $pdo->prepare("SELECT COUNT(*) FROM reports WHERE status IN ('Pending','Assigned','In Progress')$meWhere");
$stmt->execute();
$dueToday = (int)$stmt->fetchColumn();

$avgDaysStmt = $pdo->prepare("SELECT AVG(TIMESTAMPDIFF(HOUR, created_at, resolved_at)) FROM reports WHERE resolved_at IS NOT NULL AND status IN ('Resolved','Closed')$meWhere");
$avgDaysStmt->execute();
$avgDaysRaw = $avgDaysStmt->fetchColumn();
$avgResolveDays = $avgDaysRaw !== null ? round(((float)$avgDaysRaw) / 24, 1) : null;

$satisfaction = null;
try {
  $ratingStmt = $pdo->query('SELECT AVG(rating) FROM report_ratings');
  $avgRating = $ratingStmt->fetchColumn();
  if ($avgRating !== null && (float)$avgRating > 0) {
    $satisfaction = (int)round(((float)$avgRating) / 5 * 100);
  }
} catch (PDOException $e) {
  // ratings table not present
}
if ($satisfaction === null) {
  $satisfaction = $total > 0 ? (int)round($resolved / $total * 100) : 0;
}

$pP = $total > 0 ? round($pending / $total * 100) : 0;
$cP = $total > 0 ? round(($inProgress) / $total * 100) : 0;
$rP = $total > 0 ? 100 - $pP - $cP : 0;

$recentStmt = $pdo->prepare("
    SELECT r.ref_id, r.title, r.location, r.status, r.created_at, r.photo_paths, u.name AS assigned_name
    FROM reports r
    LEFT JOIN users u ON r.assigned_to = u.id
    WHERE 1=1$meWhere
    ORDER BY r.created_at DESC
    LIMIT 4
");
$recentStmt->execute();
$recent = $recentStmt->fetchAll();

// Reports created over the last 7 days (scoped to the same staff filter when present)
$week = [];
$now = new DateTime();
$start = (clone $now)->modify('-6 days')->setTime(0, 0);
for ($i = 0; $i < 7; $i++) {
    $d = (clone $start)->modify("+$i days");
    $week[] = ['day' => $d->format('D'), 'label' => $d->format('M j'), 'count' => 0];
}
$weekStmt = $pdo->prepare("SELECT DATE(created_at) AS d, COUNT(*) AS c FROM reports WHERE created_at >= ?$meWhere GROUP BY DATE(created_at)");
$weekStmt->execute([$start->format('Y-m-d 00:00:00')]);
foreach ($weekStmt->fetchAll() as $row) {
    $idx = (int)date_diff($start, new DateTime($row['d']))->days;
    if ($idx >= 0 && $idx < 7) $week[$idx]['count'] = (int)$row['c'];
}
$weekMax = max(1, max(array_column($week, 'count')));

$user = $payload ?: null;

echo json_encode([
    'total' => $total,
    'pending' => $pending,
    'verified' => $verified,
    'assigned' => $assignedCount,
    'in_progress' => $inProgress,
    'claimed' => $claimed,
    'resolved' => $resolved,
    'closed' => $closed,
    'rejected' => $rejected,
    'open' => $open,
    'resolved_this_month' => $resolvedThisMonth,
    'urgent_open' => $urgentOpen,
    'due_today' => $dueToday,
    'avg_resolve_days' => $avgResolveDays,
    'satisfaction' => $satisfaction,
    'percentages' => [
        'pending' => $pP,
        'claimed' => $cP,
        'resolved' => $rP,
    ],
    'week' => $week,
    'week_max' => $weekMax,
    'recent' => array_map(function ($r) {
        return [
            'id' => $r['ref_id'],
            'title' => $r['title'],
            'location' => $r['location'],
            'status' => $r['status'],
            'assigned' => $r['assigned_name'] ?? '-',
            'date' => date('M j, Y', strtotime($r['created_at'])),
            'photos' => json_decode($r['photo_paths'] ?? '[]', true),
        ];
    }, $recent),
    'user' => $user,
]);