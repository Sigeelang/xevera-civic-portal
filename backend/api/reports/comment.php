<?php
header('Content-Type: application/json');
require_once __DIR__ . '/../config/cors.php';

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

require_once __DIR__ . '/../middleware/auth.php';
require_once __DIR__ . '/../middleware/write_ratelimit.php';
$user = requireRole(['Resident']);
xevera_write_rate_limit($pdo, 'reports.comment');

require_once __DIR__ . '/../config/database.php';

$input = json_decode(file_get_contents('php://input'), true);
$refId = trim($input['id'] ?? '');
$comment = trim($input['comment'] ?? '');

if (!$refId || !$comment) {
    http_response_code(400);
    echo json_encode(['error' => 'Report ID and comment are required.']);
    exit;
}

$comment = mb_substr($comment, 0, 500);

$stmt = $pdo->prepare('SELECT id, ref_id, title, reporter_user_id FROM reports WHERE ref_id = ?');
$stmt->execute([$refId]);
$report = $stmt->fetch();

if (!$report) {
    http_response_code(404);
    echo json_encode(['error' => 'Report not found.']);
    exit;
}

$reportId = (int)$report['id'];
$userId = (int)$user['user_id'];

$stmt = $pdo->prepare('INSERT INTO report_comments (report_id, user_id, comment) VALUES (?, ?, ?)');
$stmt->execute([$reportId, $userId, $comment]);

$pdo->prepare('UPDATE reports SET comments_count = comments_count + 1 WHERE id = ?')->execute([$reportId]);
$count = (int)$pdo->query('SELECT comments_count FROM reports WHERE id = ' . $reportId)->fetchColumn();

$ownerId = (int)($report['reporter_user_id'] ?? 0);
if ($ownerId && $ownerId !== $userId) {
    require_once __DIR__ . '/../middleware/notification_prefs.php';
    if (pref_enabled($pdo, $ownerId, 'notify_comment')) {
        $stmt = $pdo->prepare('INSERT INTO notifications (user_id, report_id, type, message) VALUES (?, ?, ?, ?)');
        $stmt->execute([
            $ownerId,
            $reportId,
            'comment',
            'New comment on your report "' . mb_substr($report['title'], 0, 80) . '"',
        ]);
    }
}

echo json_encode(['message' => 'Comment added.', 'comments' => $count]);
