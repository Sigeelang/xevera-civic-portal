<?php
header('Content-Type: application/json');
require_once __DIR__ . '/../config/cors.php';

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once __DIR__ . '/../config/database.php';

$refId = trim($_GET['id'] ?? '');

if (!$refId) {
    http_response_code(400);
    echo json_encode(['error' => 'Report ID is required.']);
    exit;
}

$stmt = $pdo->prepare("
    SELECT r.*, u.name AS assigned_name, u.role AS assigned_role
    FROM reports r
    LEFT JOIN users u ON r.assigned_to = u.id
    WHERE r.ref_id = ?
");
$stmt->execute([$refId]);
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
    'assigned' => $report['assigned_name'] ?? '-',
    'likes' => (int)$report['likes'],
    'comments' => (int)$report['comments_count'],
    'desc' => $report['description'],
    'reporter' => !empty($report['reporter_user_id']) ? 'XR-RES-' . str_pad((int)$report['reporter_user_id'], 6, '0', STR_PAD_LEFT) : 'Anonymous',
    'photos' => json_decode($report['photo_paths'] ?? '[]', true),
    'attachments_count' => count(json_decode($report['photo_paths'] ?? '[]', true)),
    'resolution' => $report['resolution'] ?? null,
    'resolved_at' => $resolvedAt,
    'resolved_by_name' => $resolverName,
    'resolved_by_role' => $resolverRole,
    'evidence_photos' => json_decode($report['photo_paths'] ?? '[]', true),
];

if ($isStaff) {
    $response['reporter_name'] = $report['reporter_name'] ?? '';
    $response['reporter_email'] = $report['reporter_email'] ?? '';
    $response['reporter_phone'] = $report['reporter_phone'] ?? '';
    $response['assigned_id'] = (int)($report['assigned_to'] ?? 0);
}

echo json_encode($response);
