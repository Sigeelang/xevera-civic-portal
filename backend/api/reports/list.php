<?php
header('Content-Type: application/json');
require_once __DIR__ . '/../config/cors.php';

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../middleware/auth.php';

/*
 * ACCESS CONTROL: this endpoint returns report records in bulk, so it
 * requires a valid authenticated session. Unauthenticated callers receive
 * 401 and no data - there is no anonymous/guest listing.
 *
 * Authorization is derived ONLY from the signed token, never from query
 * parameters such as user id, resident id or role. requireAuth() also
 * applies the live account-status check, the token revocation list, and
 * maintenance-mode enforcement for residents.
 */
$payload = requireAuth();

$q = trim($_GET['search'] ?? '');
$category = $_GET['category'] ?? 'All';
$status = $_GET['status'] ?? 'All';
$priority = $_GET['priority'] ?? 'All';
$date = $_GET['date'] ?? '';
$sort = $_GET['sort'] ?? 'newest';
/*
 * Pagination validation. `limit` is clamped (never rejected) because existing
 * callers legitimately pass large values such as limit=100 and rely on the
 * server capping them, so rejecting would break those pages.
 */
$pageRaw = (string) ($_GET['page'] ?? '1');
$limitRaw = (string) ($_GET['limit'] ?? '8');
if (!ctype_digit($pageRaw) || (int) $pageRaw < 1 || !ctype_digit($limitRaw) || (int) $limitRaw < 1) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'error' => 'Invalid pagination parameters.',
        'code' => 'INVALID_PAGINATION',
    ]);
    exit;
}
$page = (int) $pageRaw;
$limit = min(50, (int) $limitRaw);
$offset = ($page - 1) * $limit;
$staff = $_GET['staff'] ?? 'false';
$assignedTo = $_GET['assigned_to'] ?? null;

$where = [];
$params = [];

if ($q) {
    $where[] = '(r.title LIKE ? OR r.location LIKE ? OR r.ref_id LIKE ? OR r.description LIKE ?)';
    $params[] = "%$q%";
    $params[] = "%$q%";
    $params[] = "%$q%";
    $params[] = "%$q%";
}

if ($category !== 'All') {
    $where[] = 'r.category = ?';
    $params[] = $category;
}

if ($priority !== 'All') {
    $where[] = 'r.priority = ?';
    $params[] = $priority;
}

if ($date !== '') {
    $where[] = 'DATE(r.created_at) = ?';
    $params[] = $date;
}

$dateFrom = $_GET['date_from'] ?? '';
$dateTo = $_GET['date_to'] ?? '';
if ($dateFrom !== '' && $dateTo !== '') {
    $where[] = 'DATE(r.created_at) BETWEEN ? AND ?';
    $params[] = $dateFrom;
    $params[] = $dateTo;
} elseif ($dateFrom !== '') {
    $where[] = 'DATE(r.created_at) >= ?';
    $params[] = $dateFrom;
} elseif ($dateTo !== '') {
    $where[] = 'DATE(r.created_at) <= ?';
    $params[] = $dateTo;
}

if ($status !== 'All') {
    if ($status === 'Admin Action') {
        $where[] = 'r.status IN (?, ?, ?)';
        $params[] = 'Pending';
        $params[] = 'Verified';
        $params[] = 'Resolved';
    } else {
        $where[] = 'r.status = ?';
        $params[] = $status;
    }
}

/*
 * Flagged-as-fake reports keep their workflow status, so they remain
 * visible in the staff Pending (Verify Reports) queue AND in the
 * violation Under Review queue (via reports/flagged.php) at the same
 * time. Residents see their own report rendered as "Under Review"
 * client-side via getEffectiveStatus.
 */

if ($assignedTo !== null) {
    if ($assignedTo === 'me' && $payload && isset($payload['user_id'])) {
        $where[] = 'r.assigned_to = ?';
        $params[] = (int)$payload['user_id'];
    } elseif ($assignedTo === 'none') {
        $where[] = 'r.assigned_to IS NULL';
    } elseif ($assignedTo === 'any') {
        $where[] = 'r.assigned_to IS NOT NULL';
    } elseif ($assignedTo !== '' && $assignedTo !== 'all') {
        $where[] = 'r.assigned_to = ?';
        $params[] = (int)$assignedTo;
    }
}

/*
 * Optional "hide mine": exclude reports where the viewer is the assignee
 * OR the original reporter, so a manager scanning the shared queue sees
 * only other people's tickets. Requires a valid token.
 */
$hideMine = ($_GET['hide_mine'] ?? '') === 'true' && $payload && isset($payload['user_id']);
if ($hideMine) {
    $where[] = 'NOT (r.assigned_to = ? OR r.reporter_user_id = ?)';
    $params[] = (int)$payload['user_id'];
    $params[] = (int)$payload['user_id'];
}

$whereClause = $where ? 'WHERE ' . implode(' AND ', $where) : '';

$orderDir = $sort === 'oldest' ? 'ASC' : 'DESC';

$countStmt = $pdo->prepare("SELECT COUNT(*) FROM reports r $whereClause");
$countStmt->execute($params);
$total = (int)$countStmt->fetchColumn();

$stmt = $pdo->prepare("
    SELECT r.*, u.name AS assigned_name, ru.name AS reporter_user_name
    FROM reports r
    LEFT JOIN users u ON r.assigned_to = u.id
    LEFT JOIN users ru ON r.reporter_user_id = ru.id
    $whereClause
    ORDER BY r.created_at $orderDir
    LIMIT $limit OFFSET $offset
");
$stmt->execute($params);
$reports = $stmt->fetchAll();

$isAuth = !empty($payload['user_id']);
$isStaff = $isAuth && in_array($payload['role'] ?? '', ['Staff', 'Admin', 'Super Admin'], true);

$items = array_map(function ($r) use ($isAuth, $isStaff) {
    $item = [
        'id' => $r['ref_id'],
        'title' => $r['title'],
        'category' => $r['category'],
        'location' => $r['location'],
        'date' => date('M j, Y', strtotime($r['created_at'])),
        'created_at' => $r['created_at'],
        'status' => $r['status'],
        'priority' => $r['priority'] ?? 'Normal',
        'likes' => (int)$r['likes'],
        'comments' => (int)$r['comments_count'],
        'reporter' => $isStaff
            ? ($r['reporter_user_name'] ?? $r['reporter_name'] ?? ($r['reporter_user_id'] ? 'XR-RES-' . str_pad((int)$r['reporter_user_id'], 6, '0', STR_PAD_LEFT) : 'Anonymous'))
            : (!empty($r['reporter_user_id']) ? 'XR-RES-' . str_pad((int)$r['reporter_user_id'], 6, '0', STR_PAD_LEFT) : 'Anonymous'),
        'photos' => json_decode($r['photo_paths'] ?? '[]', true),
        'is_suspicious' => (int)($r['is_suspicious'] ?? 0),
        'suspicion_reason' => $r['suspicion_reason'] ?? null,
    ];

    /*
     * Field minimization by role:
     *   Staff/Admin/Super Admin - assignee identity + full description.
     *   Authenticated resident   - a short description snippet.
     *   Anonymous guest          - NO free-text description and no internal
     *                              fields. Report descriptions are written by
     *                              residents and can contain personal
     *                              information, so they are not returned in
     *                              bulk to unauthenticated callers. No public
     *                              page renders this field.
     */
    if ($isStaff) {
        $item['assigned'] = $r['assigned_name'] ?? '-';
        $item['assigned_id'] = (int)($r['assigned_to'] ?? 0);
        $item['description'] = $r['description'];
    } elseif ($isAuth) {
        $item['description'] = mb_substr($r['description'] ?? '', 0, 200);
    }

    return $item;
}, $reports);

echo json_encode([
    'items' => $items,
    'total' => $total,
    'page' => $page,
    'limit' => $limit,
    'total_pages' => max(1, (int)ceil($total / $limit)),
]);
