<?php
header('Content-Type: application/json');
require_once __DIR__ . '/../config/cors.php';
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../middleware/auth.php';

$user = requireRole(['Admin', 'Super Admin']);

$page = max(1, (int)($_GET['page'] ?? 1));
$limit = min(100, max(1, (int)($_GET['limit'] ?? 20)));
$offset = ($page - 1) * $limit;
$status = $_GET['status'] ?? 'All';
$type = $_GET['type'] ?? 'All';
$q = trim($_GET['search'] ?? '');
$dateFrom = $_GET['date_from'] ?? '';
$dateTo = $_GET['date_to'] ?? '';
$category = trim($_GET['category'] ?? '');

// For Dismissed, we need reports that were flagged but are now dismissed (is_suspicious=0)
// For other statuses, we filter on is_suspicious=1
if ($status === 'Dismissed') {
    $where = ['r.is_suspicious = 0', 'r.suspicion_reason IS NOT NULL'];
} else {
    $where = ['r.is_suspicious = 1'];
}
$params = [];

if ($status !== 'All') {
    if ($status === 'Under Review') {
        $where[] = 'v.id IS NULL';
    } elseif ($status === 'Confirmed') {
        $where[] = 'v.status = ?';
        $params[] = 'Confirmed';
    }
}
if ($type !== 'All') {
    $where[] = 'r.suspicion_reason LIKE ?';
    $params[] = "%$type%";
}
if ($category !== '' && $category !== 'All') {
    $where[] = 'r.category = ?';
    $params[] = $category;
}
if ($q !== '') {
    $where[] = '(r.ref_id LIKE ? OR r.title LIKE ? OR r.description LIKE ? OR ru.name LIKE ?)';
    $like = "%$q%";
    $params[] = $like; $params[] = $like; $params[] = $like; $params[] = $like;
}
if ($dateFrom !== '' && $dateTo !== '') {
    $where[] = 'DATE(r.created_at) BETWEEN ? AND ?';
    $params[] = $dateFrom; $params[] = $dateTo;
} elseif ($dateFrom !== '') {
    $where[] = 'DATE(r.created_at) >= ?';
    $params[] = $dateFrom;
} elseif ($dateTo !== '') {
    $where[] = 'DATE(r.created_at) <= ?';
    $params[] = $dateTo;
}

$whereClause = 'WHERE ' . implode(' AND ', $where);

$countStmt = $pdo->prepare("
    SELECT COUNT(*)
    FROM reports r
    LEFT JOIN violations v ON v.report_id = r.id
    LEFT JOIN users ru ON r.reporter_user_id = ru.id
    $whereClause
");
$countStmt->execute($params);
$total = (int)$countStmt->fetchColumn();

$stmt = $pdo->prepare("
    SELECT r.*, ru.name AS reporter_name, ru.email AS reporter_email,
           v.id AS violation_id, v.status AS violation_status, v.violation_type,
           v.severity, v.penalty_amount, v.suspension_days, v.description AS violation_reason,
           v.created_at AS violation_created_at
    FROM reports r
    LEFT JOIN violations v ON v.report_id = r.id
    LEFT JOIN users ru ON r.reporter_user_id = ru.id
    $whereClause
    ORDER BY r.created_at DESC
    LIMIT $limit OFFSET $offset
");
$stmt->execute($params);
$reports = $stmt->fetchAll();

$items = array_map(function ($r) {
    $violationStatus = null;
    if ($r['is_suspicious'] == 0 && $r['suspicion_reason']) {
        $violationStatus = 'Dismissed';
    } elseif ($r['violation_id']) {
        $violationStatus = $r['violation_status'];
    } elseif ($r['is_suspicious']) {
        $violationStatus = 'Under Review';
    }

    return [
        'id' => $r['ref_id'],
        'db_id' => (int)$r['id'],
        'title' => $r['title'],
        'description' => $r['description'],
        'category' => $r['category'],
        'location' => $r['location'],
        'date' => date('M j, Y', strtotime($r['created_at'])),
        'created_at' => $r['created_at'],
        'status' => $r['status'],
        'reporter_name' => $r['reporter_name'] ?? '',
        'reporter_email' => $r['reporter_email'] ?? '',
        'reporter_user_id' => (int)($r['reporter_user_id'] ?? 0),
        'is_suspicious' => (int)$r['is_suspicious'],
        'suspicion_reason' => $r['suspicion_reason'] ?? null,
        'photos' => json_decode($r['photo_paths'] ?? '[]', true),
        'violation_id' => $r['violation_id'] ? (int)$r['violation_id'] : null,
        'violation_status' => $violationStatus,
        'violation_type' => $r['violation_type'] ?? null,
        'severity' => $r['severity'] ?? null,
        'fine' => $r['penalty_amount'] ? (float)$r['penalty_amount'] : null,
        'restriction_days' => $r['suspension_days'] ? (int)$r['suspension_days'] : null,
        'violation_reason' => $r['violation_reason'] ?? null,
    ];
}, $reports);

// Stats
$statsStmt = $pdo->prepare("SELECT COUNT(*) FROM reports WHERE is_suspicious = 1");
$statsStmt->execute();
$totalFlagged = (int)$statsStmt->fetchColumn();

$reviewStmt = $pdo->prepare("SELECT COUNT(*) FROM reports r LEFT JOIN violations v ON v.report_id = r.id WHERE r.is_suspicious = 1 AND v.id IS NULL");
$reviewStmt->execute();
$underReview = (int)$reviewStmt->fetchColumn();

$confirmedStmt = $pdo->prepare("SELECT COUNT(*) FROM violations WHERE status = 'Confirmed'");
$confirmedStmt->execute();
$confirmed = (int)$confirmedStmt->fetchColumn();

$dismissedStmt = $pdo->prepare("SELECT COUNT(*) FROM reports WHERE is_suspicious = 0 AND suspicion_reason IS NOT NULL");
$dismissedStmt->execute();
$dismissed = (int)$dismissedStmt->fetchColumn();

// Detailed stats for sub-views
$totalFinesStmt = $pdo->prepare("SELECT COALESCE(SUM(penalty_amount), 0) FROM violations WHERE status = 'Confirmed'");
$totalFinesStmt->execute();
$totalFines = (int)$totalFinesStmt->fetchColumn();

$pendingPayStmt = $pdo->prepare("SELECT COUNT(*) FROM violations WHERE status = 'Confirmed'");
$pendingPayStmt->execute();
$pendingPayments = (int)$pendingPayStmt->fetchColumn();

$paidStmt = $pdo->prepare("SELECT COUNT(*) FROM violations WHERE status = 'Resolved'");
$paidStmt->execute();
$paid = (int)$paidStmt->fetchColumn();

$appealedStmt = $pdo->prepare("SELECT COUNT(*) FROM violations WHERE status = 'Appealed'");
$appealedStmt->execute();
$appealed = (int)$appealedStmt->fetchColumn();

$reopenedStmt = $pdo->prepare("SELECT COUNT(*) FROM reports WHERE is_suspicious = 1 AND suspicion_reason IS NOT NULL AND status != 'Pending'");
$reopenedStmt->execute();
$reopened = (int)$reopenedStmt->fetchColumn();

$repeatStmt = $pdo->prepare("SELECT COUNT(*) FROM (SELECT reporter_user_id FROM reports WHERE is_suspicious = 1 AND reporter_user_id IS NOT NULL GROUP BY reporter_user_id HAVING COUNT(*) > 1) t");
$repeatStmt->execute();
$repeatOffenders = (int)$repeatStmt->fetchColumn();

$fakeStmt = $pdo->prepare("SELECT COUNT(*) FROM reports r LEFT JOIN violations v ON v.report_id = r.id WHERE r.is_suspicious = 1 AND v.id IS NULL");
$fakeStmt->execute();
$fakeReports = (int)$fakeStmt->fetchColumn();

echo json_encode([
    'items' => $items,
    'total' => $total,
    'page' => $page,
    'limit' => $limit,
    'total_pages' => max(1, (int)ceil($total / $limit)),
    'stats' => [
        'total' => $totalFlagged,
        'under_review' => $underReview,
        'confirmed' => $confirmed,
        'dismissed' => $dismissed,
        'total_fines' => $totalFines,
        'pending_payments' => $pendingPayments,
        'paid' => $paid,
        'appealed' => $appealed,
        'reopened' => $reopened,
        'repeat_offenders' => $repeatOffenders,
        'fake_reports' => $fakeReports,
    ],
]);
