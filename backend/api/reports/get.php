<?php
header('Content-Type: application/json');
require_once __DIR__ . '/../config/cors.php';

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    header('Allow: GET, OPTIONS');
    echo json_encode(['error' => 'Method not allowed', 'code' => 'METHOD_NOT_ALLOWED']);
    exit;
}

require_once __DIR__ . '/../config/database.php';

$refId = trim($_GET['id'] ?? '');

if (!$refId) {
    http_response_code(400);
    echo json_encode(['error' => 'Report ID is required.']);
    exit;
}

/* Accept the public ref_id or the numeric row id. */
$byNumericId = ctype_digit($refId);
$idColumn = $byNumericId ? 'id' : 'ref_id';
$idValue = $byNumericId ? (int)$refId : $refId;

$stmt = $pdo->prepare("
    SELECT r.*, u.name AS assigned_name, u.role AS assigned_role, ru.name AS reporter_user_name
    FROM reports r
    LEFT JOIN users u ON r.assigned_to = u.id
    LEFT JOIN users ru ON r.reporter_user_id = ru.id
    WHERE r.$idColumn = ?
");
$stmt->execute([$idValue]);
$report = $stmt->fetch();

// Fetch resolver info from history for Resolved reports
$resolverName = null;
$resolverRole = null;
$resolvedAt = $report['resolved_at'] ?? null;
if ($report['status'] === 'Resolved') {
    $hStmt = $pdo->prepare("
        SELECT h.note, h.created_at, u.name, u.role
        FROM report_status_history h
        LEFT JOIN users u ON h.acted_by = u.id
        WHERE h.report_id = ? AND h.new_status = 'Resolved'
        ORDER BY h.created_at DESC, h.id DESC LIMIT 1
    ");
    $hStmt->execute([(int)$report['id']]);
    $hRow = $hStmt->fetch();
    if ($hRow) {
        $resolverName = $hRow['name'] ?? $report['assigned_name'];
        $resolverRole = $hRow['role'] ?? $report['assigned_role'];
        $resolvedAt = $hRow['created_at'] ?? $resolvedAt;
    } else {
        $resolverName = $report['assigned_name'];
        $resolverRole = $report['assigned_role'];
    }
}

if (!$report) {
    http_response_code(404);
    echo json_encode(['error' => 'Report not found.']);
    exit;
}

require_once __DIR__ . '/../middleware/token.php';
$payload = token_payload();
$isAuth = !empty($payload['user_id']);
$isStaff = $isAuth && in_array($payload['role'] ?? '', ['Staff', 'Admin', 'Super Admin'], true);
$isOwner = $isAuth && (int)$payload['user_id'] === (int)$report['reporter_user_id'];

$response = [
    'id' => $report['ref_id'],
    'title' => $report['title'],
    'category' => $report['category'],
    'location' => $report['location'],
    'date' => date('M j, Y', strtotime($report['created_at'])),
    'created_at' => $report['created_at'],
    'status' => $report['status'],
    /*
     * Staff identity is not exposed to anonymous visitors: a guest sees the
     * role label, while authenticated users see the real name.
     */
    'assigned' => !empty($report['assigned_name'])
        ? ($isAuth ? $report['assigned_name'] : 'Assigned Staff')
        : '-',
    'likes' => (int)$report['likes'],
    'comments' => (int)$report['comments_count'],
    'dislikes' => isset($report['dislikes']) ? (int)$report['dislikes'] : 0,
    'liked' => false,
    'disliked' => false,
    /*
     * Report descriptions are written by residents and can contain personal
     * information (names, unit numbers, circumstances). Anonymous visitors
     * get the public record - id, title, category, status, timeline, photos -
     * but not the free-text description. Authenticated users (including the
     * reporter) always receive the real text.
     */
    'desc' => $isAuth
        ? $report['description']
        : 'Sign in to view the full report details.',
    'reporter' => $isStaff
        ? ($report['reporter_user_name'] ?? $report['reporter_name'] ?? ($report['reporter_user_id'] ? 'XR-RES-' . str_pad((int)$report['reporter_user_id'], 6, '0', STR_PAD_LEFT) : 'Anonymous'))
        : (!empty($report['reporter_user_id']) ? 'XR-RES-' . str_pad((int)$report['reporter_user_id'], 6, '0', STR_PAD_LEFT) : 'Anonymous'),
    'photos' => json_decode($report['photo_paths'] ?? '[]', true),
    'attachments_count' => count(json_decode($report['photo_paths'] ?? '[]', true)),
    'resolution' => $report['resolution'] ?? null,
    'resolved_at' => $resolvedAt,
    // Same rule as `assigned`: never reveal a staff name to anonymous callers.
    'resolved_by_name' => !empty($resolverName)
        ? ($isAuth ? $resolverName : 'Xevera Staff')
        : null,
    'resolved_by_role' => $resolverRole,
    /*
     * Staff resolution evidence lives in its own evidence_paths column,
     * separate from the reporter's original photo_paths - so viewers see
     * exactly what the staff member uploaded as proof of resolution.
     */
    'evidence_photos' => json_decode($report['evidence_paths'] ?? '[]', true),
    'is_suspicious' => (int)($report['is_suspicious'] ?? 0),
    'suspicion_reason' => $report['suspicion_reason'] ?? null,
];

if ($isStaff) {
    $response['reporter_name'] = $report['reporter_name'] ?? '';
    $response['reporter_email'] = $report['reporter_email'] ?? '';
    $response['reporter_phone'] = $report['reporter_phone'] ?? '';
    $response['assigned_id'] = (int)($report['assigned_to'] ?? 0);
}

/* Viewer reaction state (pre-migration safe: missing table = false). */
if ($isAuth) {
    $viewerId = (int)$payload['user_id'];
    try {
        $lkStmt = $pdo->prepare('SELECT 1 FROM report_likes WHERE report_id = ? AND user_id = ? LIMIT 1');
        $lkStmt->execute([(int)$report['id'], $viewerId]);
        $response['liked'] = (bool)$lkStmt->fetchColumn();
    } catch (Throwable $e) { /* ignore */ }
    try {
        $dkStmt = $pdo->prepare('SELECT 1 FROM report_dislikes WHERE report_id = ? AND user_id = ? LIMIT 1');
        $dkStmt->execute([(int)$report['id'], $viewerId]);
        $response['disliked'] = (bool)$dkStmt->fetchColumn();
    } catch (Throwable $e) { /* ignore */ }
}

echo json_encode($response);
