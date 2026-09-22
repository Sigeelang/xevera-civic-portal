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
$user = requirePermission('reports', ['Resident']);
xevera_write_rate_limit($pdo, 'reports.dislike');

require_once __DIR__ . '/../config/database.php';

$input = json_decode(file_get_contents('php://input'), true);
$refId = trim($input['id'] ?? '');

if (!$refId) {
    http_response_code(400);
    echo json_encode(['error' => 'Report ID is required.']);
    exit;
}

$stmt = $pdo->prepare('SELECT id, ref_id, title FROM reports WHERE ref_id = ?');
$stmt->execute([$refId]);
$report = $stmt->fetch();

if (!$report) {
    http_response_code(404);
    echo json_encode(['error' => 'Report not found.']);
    exit;
}

$reportId = (int)$report['id'];
$userId = (int)$user['user_id'];

$stmt = $pdo->prepare('SELECT id FROM report_dislikes WHERE report_id = ? AND user_id = ?');
$stmt->execute([$reportId, $userId]);
$existing = $stmt->fetch();

if ($existing) {
    $stmt = $pdo->prepare('DELETE FROM report_dislikes WHERE report_id = ? AND user_id = ?');
    $stmt->execute([$reportId, $userId]);
    $pdo->prepare('UPDATE reports SET dislikes = GREATEST(0, dislikes - 1) WHERE id = ?')->execute([$reportId]);
    $disliked = false;
} else {
    $stmt = $pdo->prepare('INSERT INTO report_dislikes (report_id, user_id) VALUES (?, ?)');
    $stmt->execute([$reportId, $userId]);
    $pdo->prepare('UPDATE reports SET dislikes = dislikes + 1 WHERE id = ?')->execute([$reportId]);
    $disliked = true;

    // Mutual exclusion: a dislike removes any existing like.
    $hadLikeStmt = $pdo->prepare('SELECT 1 FROM report_likes WHERE report_id = ? AND user_id = ? LIMIT 1');
    $hadLikeStmt->execute([$reportId, $userId]);
    if ($hadLikeStmt->fetchColumn()) {
        $pdo->prepare('DELETE FROM report_likes WHERE report_id = ? AND user_id = ?')->execute([$reportId, $userId]);
        $pdo->prepare('UPDATE reports SET likes = GREATEST(0, likes - 1) WHERE id = ?')->execute([$reportId]);
    }
}

// Recompute authoritative state (protects against any drift).
$lkStmt = $pdo->prepare('SELECT 1 FROM report_likes WHERE report_id = ? AND user_id = ? LIMIT 1');
$lkStmt->execute([$reportId, $userId]);
$liked = (bool)$lkStmt->fetchColumn();

$counts = $pdo->prepare('SELECT likes, dislikes FROM reports WHERE id = ?');
$counts->execute([$reportId]);
$row = $counts->fetch();

echo json_encode([
    'disliked' => $disliked,
    'dislikes' => (int)($row['dislikes'] ?? 0),
    'liked' => $liked,
    'likes' => (int)($row['likes'] ?? 0),
]);
