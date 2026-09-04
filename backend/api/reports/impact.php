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
require_once __DIR__ . '/../middleware/auth.php';

$user = requireRole(['Resident']);
$userId = (int)$user['user_id'];

/* Match the resident's reports by account id OR, for reports created
   before account linking, by the reporter email used at submission. */
$emailStmt = $pdo->prepare('SELECT email FROM users WHERE id = ?');
$emailStmt->execute([$userId]);
$email = trim($emailStmt->fetchColumn() ?: '');

$agg = $pdo->prepare("
    SELECT
        COUNT(*) AS submitted,
        SUM(status = 'Pending') AS pending,
        SUM(status IN ('Verified', 'Assigned', 'In Progress')) AS in_progress,
        SUM(status IN ('Resolved', 'Closed')) AS resolved,
        SUM(status = 'Rejected') AS rejected,
        SUM(verified_at IS NOT NULL) AS verified,
        COALESCE(SUM(likes), 0) AS likes_received,
        COALESCE(SUM(comments_count), 0) AS comments_received
    FROM reports
    WHERE reporter_user_id = ? OR (reporter_user_id IS NULL AND reporter_email = ?)
");
$agg->execute([$userId, $email]);
$row = $agg->fetch();

$follows = $pdo->prepare('SELECT COUNT(*) FROM report_follows WHERE user_id = ?');
$follows->execute([$userId]);
$following = (int)$follows->fetchColumn();

$days = $pdo->prepare('SELECT DATEDIFF(CURDATE(), DATE(created_at)) FROM users WHERE id = ?');
$days->execute([$userId]);
$daysActive = (int)$days->fetchColumn();

echo json_encode([
    'submitted' => (int)$row['submitted'],
    'pending' => (int)$row['pending'],
    'in_progress' => (int)$row['in_progress'],
    'resolved' => (int)$row['resolved'],
    'rejected' => (int)$row['rejected'],
    'verified' => (int)$row['verified'],
    'likes_received' => (int)$row['likes_received'],
    'comments_received' => (int)$row['comments_received'],
    'following' => $following,
    'days_active' => $daysActive,
]);