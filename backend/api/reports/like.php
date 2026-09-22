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
xevera_write_rate_limit($pdo, 'reports.like');

require_once __DIR__ . '/../config/database.php';

$input = json_decode(file_get_contents('php://input'), true);
$refId = trim($input['id'] ?? '');

if (!$refId) {
    http_response_code(400);
    echo json_encode(['error' => 'Report ID is required.']);
    exit;
}

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

$stmt = $pdo->prepare('SELECT id FROM report_likes WHERE report_id = ? AND user_id = ?');
$stmt->execute([$reportId, $userId]);
$existing = $stmt->fetch();

if ($existing) {
    $stmt = $pdo->prepare('DELETE FROM report_likes WHERE report_id = ? AND user_id = ?');
    $stmt->execute([$reportId, $userId]);
    $pdo->prepare('UPDATE reports SET likes = GREATEST(0, likes - 1) WHERE id = ?')->execute([$reportId]);
    $liked = false;
} else {
    $stmt = $pdo->prepare('INSERT INTO report_likes (report_id, user_id) VALUES (?, ?)');
    $stmt->execute([$reportId, $userId]);
    $pdo->prepare('UPDATE reports SET likes = likes + 1 WHERE id = ?')->execute([$reportId]);
    $liked = true;

    // Mutual exclusion: a like removes any existing dislike.
    $hadDislikeStmt = $pdo->prepare('SELECT 1 FROM report_dislikes WHERE report_id = ? AND user_id = ? LIMIT 1');
    $hadDislike = false;
    try {
        $hadDislikeStmt->execute([$reportId, $userId]);
        $hadDislike = (bool)$hadDislikeStmt->fetchColumn();
    } catch (Throwable $e) { /* pre-migration: table missing */ }
    if ($hadDislike) {
        $pdo->prepare('DELETE FROM report_dislikes WHERE report_id = ? AND user_id = ?')->execute([$reportId, $userId]);
        $pdo->prepare('UPDATE reports SET dislikes = GREATEST(0, dislikes - 1) WHERE id = ?')->execute([$reportId]);
    }

    $ownerId = (int)($report['reporter_user_id'] ?? 0);
    if ($ownerId && $ownerId !== $userId) {
        require_once __DIR__ . '/../middleware/notification_prefs.php';
        if (pref_enabled($pdo, $ownerId, 'notify_like')) {
            $stmt = $pdo->prepare('INSERT INTO notifications (user_id, report_id, type, message) VALUES (?, ?, ?, ?)');
            $stmt->execute([
                $ownerId,
                $reportId,
                'like',
                'Someone liked your report "' . mb_substr($report['title'], 0, 80) . '"',
            ]);
        }
    }
}

$likes = (int)$pdo->query('SELECT likes FROM reports WHERE id = ' . $reportId)->fetchColumn();

// Authoritative full reaction state (pre-migration safe).
$dislikes = 0;
$disliked = false;
try {
    $dislikes = (int)$pdo->query('SELECT dislikes FROM reports WHERE id = ' . $reportId)->fetchColumn();
    $dStmt = $pdo->prepare('SELECT 1 FROM report_dislikes WHERE report_id = ? AND user_id = ? LIMIT 1');
    $dStmt->execute([$reportId, $userId]);
    $disliked = (bool)$dStmt->fetchColumn();
} catch (Throwable $e) { /* pre-migration: table/column missing */ }

echo json_encode(['liked' => $liked, 'likes' => $likes, 'disliked' => $disliked, 'dislikes' => $dislikes]);
