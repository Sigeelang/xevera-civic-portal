<?php
header('Content-Type: application/json');
require_once __DIR__ . '/../config/cors.php';

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

require_once __DIR__ . '/../middleware/auth.php';
requireRole(['Admin', 'Super Admin']);

require_once __DIR__ . '/../config/database.php';

// --- by status (canonical enum; legacy 'Claimed' folded into 'In Progress') ---
$byStatus = ['total' => 0, 'Pending' => 0, 'Verified' => 0, 'Assigned' => 0, 'In Progress' => 0, 'Resolved' => 0, 'Closed' => 0, 'Rejected' => 0];
$stmt = $pdo->query('SELECT status, COUNT(*) AS c FROM reports GROUP BY status');
foreach ($stmt->fetchAll() as $row) {
    $byStatus['total'] += (int)$row['c'];
    $key = $row['status'] === 'Claimed' ? 'In Progress' : $row['status'];
    if (isset($byStatus[$key])) $byStatus[$key] = (int)$row['c'];
}
$open = $byStatus['Pending'] + $byStatus['Verified'] + $byStatus['Assigned'] + $byStatus['In Progress'];

// --- reports this week (last 7 days by weekday) ---
$week = [];
$now = new DateTime();
$start = (clone $now)->modify('-6 days')->setTime(0, 0);
for ($i = 0; $i < 7; $i++) {
    $d = (clone $start)->modify("+$i days");
    $week[] = ['day' => $d->format('D'), 'label' => $d->format('M j'), 'count' => 0];
}
$stmt = $pdo->prepare("SELECT DATE(created_at) AS d, COUNT(*) AS c FROM reports WHERE created_at >= ? GROUP BY DATE(created_at)");
$stmt->execute([$start->format('Y-m-d 00:00:00')]);
foreach ($stmt->fetchAll() as $row) {
    $idx = (int)date_diff($start, new DateTime($row['d']))->days;
    if ($idx >= 0 && $idx < 7) $week[$idx]['count'] = (int)$row['c'];
}
$weekMax = max(1, max(array_column($week, 'count')));

// --- by category ---
$stmt = $pdo->query('SELECT category, COUNT(*) AS c FROM reports GROUP BY category ORDER BY c DESC');
$categoryCount = $stmt->fetchAll();

// --- urgent / emergency open ---
$stmt = $pdo->prepare("SELECT r.ref_id, r.title, r.location, r.priority, r.status, r.created_at, u.name AS assigned_name
    FROM reports r LEFT JOIN users u ON r.assigned_to = u.id
    WHERE r.priority = 'Urgent' AND r.status IN ('Pending','Verified','Assigned','In Progress')
    ORDER BY r.created_at DESC LIMIT 10");
$stmt->execute();
$urgent = array_map(function ($r) {
    return [
        'id' => $r['ref_id'],
        'title' => $r['title'],
        'location' => $r['location'],
        'status' => $r['status'],
        'assigned' => $r['assigned_name'] ?? '-',
        'date' => date('M j, Y', strtotime($r['created_at'])),
    ];
}, $stmt->fetchAll());

// --- staff performance ---
$stmt = $pdo->prepare("
    SELECT u.id, u.name,
        SUM(r.assigned_to IS NOT NULL) AS assigned,
        SUM(r.status = 'Resolved') AS resolved,
        AVG(CASE WHEN r.status = 'Resolved' AND r.verified_at IS NOT NULL THEN TIMESTAMPDIFF(HOUR, r.created_at, r.verified_at) END) AS hours
    FROM users u
    LEFT JOIN reports r ON r.assigned_to = u.id
    WHERE u.role IN ('Staff','Admin')
    GROUP BY u.id, u.name
    HAVING assigned > 0
    ORDER BY resolved DESC");
$stmt->execute();
$staff = array_map(function ($s) {
    $assigned = (int)$s['assigned'];
    $resolved = (int)$s['resolved'];
    return [
        'name' => $s['name'],
        'assigned' => $assigned,
        'resolved' => $resolved,
        'rate' => $assigned > 0 ? round($resolved / $assigned * 100) : 0,
        'hours' => $s['hours'] !== null ? round((float)$s['hours'], 1) : null,
    ];
}, $stmt->fetchAll());

// --- response time (avg hours Pending -> Claimed/Resolved, from history) ---
$stmt = $pdo->query("
    SELECT AVG(TIMESTAMPDIFF(HOUR, r.created_at, h.created_at)) AS avg_hours
    FROM report_status_history h
    JOIN reports r ON r.id = h.report_id
    WHERE h.new_status IN ('Claimed','In Progress','Assigned','Resolved')
");
$responseAvg = $stmt->fetchColumn();
$responseAvg = $responseAvg !== null ? round((float)$responseAvg, 1) : null;

// --- recent reports ---
$stmt = $pdo->prepare("
    SELECT r.ref_id, r.title, r.category, r.priority, r.location, r.status, r.created_at, r.reporter_name,
           u.name AS assigned_name
    FROM reports r
    LEFT JOIN users u ON r.assigned_to = u.id
    ORDER BY r.created_at DESC
    LIMIT 8
");
$stmt->execute();
$recent = array_map(function ($r) {
    return [
        'id' => $r['ref_id'],
        'title' => $r['title'],
        'category' => $r['category'],
        'priority' => $r['priority'],
        'location' => $r['location'],
        'status' => $r['status'],
        'reporter' => $r['reporter_name'] ?? 'Anonymous',
        'assigned' => $r['assigned_name'] ?? '-',
        'date' => date('M j, Y', strtotime($r['created_at'])),
    ];
}, $stmt->fetchAll());

echo json_encode([
    'by_status' => $byStatus,
    'open' => $open,
    'week' => $week,
    'week_max' => $weekMax,
    'category_count' => $categoryCount,
    'urgent' => $urgent,
    'urgent_count' => count($urgent),
    'staff' => $staff,
    'response_avg' => $responseAvg,
    'recent' => $recent,
]);