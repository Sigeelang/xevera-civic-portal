<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

require_once __DIR__ . '/../middleware/auth.php';
require_once __DIR__ . '/../middleware/write_ratelimit.php';
$user = requireRole(['Resident']);
xevera_write_rate_limit($pdo, 'feedback.submit');

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../middleware/ratelimit.php';
checkRateLimit($pdo, 10, 3600, 'feedback');

$userId = (int)$user['user_id'];
$input = json_decode(file_get_contents('php://input'), true) ?: [];

$refId = trim($input['ref_id'] ?? '');
$rating = (int)($input['rating'] ?? 0);
$comment = trim((string)($input['comment'] ?? ''));

if ($rating < 1 || $rating > 5) {
    http_response_code(400);
    echo json_encode(['error' => 'Rating must be between 1 and 5.']);
    exit;
}
if (mb_strlen($comment) > 1000) {
    http_response_code(400);
    echo json_encode(['error' => 'Comment is too long.']);
    exit;
}

$stmt = $pdo->prepare('SELECT id, status FROM reports WHERE ref_id = ?');
$stmt->execute([$refId]);
$report = $stmt->fetch();

if (!$report) {
    http_response_code(404);
    echo json_encode(['error' => 'Report not found.']);
    exit;
}

if (!in_array($report['status'], ['Resolved', 'Closed'], true)) {
    http_response_code(400);
    echo json_encode(['error' => 'You can only rate a resolved or closed report.']);
    exit;
}

$reportId = (int)$report['id'];

// One rating per resident per report — upsert so re-ratings update instead of duplicate.
$stmt = $pdo->prepare('SELECT id FROM feedback WHERE report_id = ? AND resident_id = ?');
$stmt->execute([$reportId, $userId]);
$existing = $stmt->fetch();

if ($existing) {
    $stmt = $pdo->prepare('UPDATE feedback SET rating = ?, comment = ? WHERE id = ?');
    $stmt->execute([$rating, $comment !== '' ? $comment : null, (int)$existing['id']]);
    $action = 'update_feedback';
} else {
    $stmt = $pdo->prepare('INSERT INTO feedback (report_id, resident_id, rating, comment) VALUES (?, ?, ?, ?)');
    $stmt->execute([$reportId, $userId, $rating, $comment !== '' ? $comment : null]);
    $action = 'create_feedback';
}

$stmt = $pdo->prepare('INSERT INTO activity_logs (user_id, action, target_type, target_id, detail) VALUES (?, ?, ?, ?, ?)');
$stmt->execute([$userId, $action, 'report', $reportId, 'Rated report ' . $refId . ' ' . $rating . '/5']);

echo json_encode(['success' => true, 'message' => 'Thank you for your feedback.', 'rating' => $rating]);