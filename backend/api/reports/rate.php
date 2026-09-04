<?php
header('Content-Type: application/json');
require_once __DIR__ . '/../config/cors.php';

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../middleware/token.php';

$refId = trim($_GET['id'] ?? '');

if (!$refId) {
    http_response_code(400);
    echo json_encode(['error' => 'Report ID is required.']);
    exit;
}

$stmt = $pdo->prepare('SELECT id, ref_id FROM reports WHERE ref_id = ?');
$stmt->execute([$refId]);
$report = $stmt->fetch();

if (!$report) {
    http_response_code(404);
    echo json_encode(['error' => 'Report not found.']);
    exit;
}

$reportId = (int)$report['id'];

// Aggregate stats (public)
$agg = $pdo->prepare('SELECT COUNT(*) AS count, COALESCE(AVG(rating), 0) AS avg FROM report_ratings WHERE report_id = ?');
$agg->execute([$reportId]);
$stats = $agg->fetch();

$result = [
    'count' => (int)$stats['count'],
    'average' => round((float)$stats['avg'], 1),
];

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    require_once __DIR__ . '/../middleware/auth.php';
    $user = requireRole(['Resident']);
    $userId = (int)$user['user_id'];

    $input = json_decode(file_get_contents('php://input'), true);
    $rating = (int)($input['rating'] ?? 0);
    $comment = trim($input['comment'] ?? '');

    if ($rating < 1 || $rating > 5) {
        http_response_code(400);
        echo json_encode(['error' => 'Rating must be between 1 and 5.']);
        exit;
    }

    $stmt = $pdo->prepare('SELECT id FROM report_ratings WHERE report_id = ? AND user_id = ?');
    $stmt->execute([$reportId, $userId]);
    $existing = $stmt->fetch();

    if ($existing) {
        $stmt = $pdo->prepare('UPDATE report_ratings SET rating = ?, comment = ? WHERE id = ?');
        $stmt->execute([$rating, $comment, $existing['id']]);
    } else {
        $stmt = $pdo->prepare('INSERT INTO report_ratings (report_id, user_id, rating, comment) VALUES (?, ?, ?, ?)');
        $stmt->execute([$reportId, $userId, $rating, $comment]);
    }

    $agg = $pdo->prepare('SELECT COUNT(*) AS count, COALESCE(AVG(rating), 0) AS avg FROM report_ratings WHERE report_id = ?');
    $agg->execute([$reportId]);
    $stats = $agg->fetch();

    $result = [
        'count' => (int)$stats['count'],
        'average' => round((float)$stats['avg'], 1),
        'rated' => true,
    ];
}

echo json_encode($result);
