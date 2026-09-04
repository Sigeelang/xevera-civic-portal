<?php
header('Content-Type: application/json');
require_once __DIR__ . '/../config/cors.php';

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }
if ($_SERVER['REQUEST_METHOD'] !== 'GET') { http_response_code(405); echo json_encode(['error' => 'Method not allowed']); exit; }

require_once __DIR__ . '/../middleware/auth.php';
$user = requireRole(['Staff', 'Admin', 'Super Admin']);

require_once __DIR__ . '/../config/database.php';

$stmt = $pdo->query("SELECT status, COUNT(*) AS c FROM follow_ups GROUP BY status");
$counts = ['Pending' => 0, 'Waiting' => 0, 'Completed' => 0, 'total' => 0];
foreach ($stmt->fetchAll() as $row) {
    $counts['total'] += (int)$row['c'];
    if (isset($counts[$row['status']])) $counts[$row['status']] = (int)$row['c'];
}

$stmt = $pdo->query("SELECT COUNT(*) FROM follow_ups WHERE status != 'Completed' AND due_date IS NOT NULL AND due_date < CURDATE()");
$overdue = (int)$stmt->fetchColumn();

$stmt = $pdo->query("SELECT COUNT(*) FROM follow_ups WHERE status != 'Completed' AND due_date = CURDATE()");
$dueToday = (int)$stmt->fetchColumn();

$stmt = $pdo->prepare("SELECT COUNT(*) FROM follow_ups WHERE status != 'Completed' AND owner_id = ?");
$stmt->execute([$user['user_id']]);
$mine = (int)$stmt->fetchColumn();

echo json_encode([
    'counts' => $counts,
    'overdue' => $overdue,
    'due_today' => $dueToday,
    'mine' => $mine,
]);