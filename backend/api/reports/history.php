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

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../middleware/token.php';

/*
 * Privacy: this endpoint is public (guests + residents read it on the
 * report page), but the actor is a staff/admin person. Authenticated
 * callers see the real name; unauthenticated callers only get the role
 * plus a generic label, so staff identities cannot be enumerated from
 * a public report URL.
 */
$payload = token_payload();
$isAuthenticated = !empty($payload['user_id']);

$refId = trim($_GET['id'] ?? '');

if (!$refId) {
    http_response_code(400);
    echo json_encode(['error' => 'Report ID is required.']);
    exit;
}

$stmt = $pdo->prepare('SELECT id FROM reports WHERE ref_id = ?');
$stmt->execute([$refId]);
$reportId = $stmt->fetchColumn();

if (!$reportId) {
    http_response_code(404);
    echo json_encode(['error' => 'Report not found.']);
    exit;
}

/*
 * Only resident-visible entries are returned: internal/private notes must
 * never reach a resident's report page. Entries without a visibility value
 * (legacy rows) default to resident-visible.
 */
$stmt = $pdo->prepare("
    SELECT h.id, h.old_status, h.new_status, h.note, h.created_at, u.name AS actor, u.role AS actor_role
    FROM report_status_history h
    LEFT JOIN users u ON h.acted_by = u.id
    WHERE h.report_id = ?
      AND (h.visibility IS NULL OR h.visibility = 'resident')
    ORDER BY h.created_at ASC, h.id ASC
");
$stmt->execute([(int)$reportId]);
$rows = $stmt->fetchAll();

$label = function ($s) {
    if ($s === 'Claimed') return 'In Progress';
    return $s;
};

echo json_encode(array_map(function ($h) use ($label, $isAuthenticated) {
    $actor = $h['actor'] ?? null;
    if (!$isAuthenticated && $actor !== null) {
        // Never expose a staff/admin name to an anonymous visitor.
        $actor = 'Xevera Team';
    }

    return [
        'id' => (int)$h['id'],
        'old_status' => $h['old_status'] ? $label($h['old_status']) : null,
        'new_status' => $label($h['new_status']),
        'note' => $h['note'],
        'actor' => $actor,
        'actor_role' => $h['actor_role'] ?? null,
        'date' => date('M j, Y g:i A', strtotime($h['created_at'])),
    ];
}, $rows));