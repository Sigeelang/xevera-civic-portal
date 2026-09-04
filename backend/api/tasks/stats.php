<?php
header('Content-Type: application/json');
require_once __DIR__ . '/../config/cors.php';

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }
if ($_SERVER['REQUEST_METHOD'] !== 'GET') { http_response_code(405); echo json_encode(['error' => 'Method not allowed']); exit; }

require_once __DIR__ . '/../middleware/auth.php';
$user = requireRole(['Staff', 'Admin', 'Super Admin']);

require_once __DIR__ . '/../config/database.php';

$stmt = $pdo->query("SELECT `column`, COUNT(*) AS c FROM tasks GROUP BY `column`");
$counts = ['To Do' => 0, 'In Progress' => 0, 'Done' => 0, 'total' => 0];
foreach ($stmt->fetchAll() as $row) {
    $counts['total'] += (int)$row['c'];
    if (isset($counts[$row['column']])) $counts[$row['column']] = (int)$row['c'];
}

$stmt = $pdo->query("SELECT COUNT(*) FROM tasks WHERE due_date IS NOT NULL AND `column` != 'Done' AND due_date < CURDATE()");
$overdue = (int)$stmt->fetchColumn();

$stmt = $pdo->prepare("SELECT COUNT(*) FROM tasks WHERE `column` != 'Done' AND assigned_to = ?");
$stmt->execute([$user['user_id']]);
$mine = (int)$stmt->fetchColumn();

echo json_encode([
    'counts' => $counts,
    'overdue' => $overdue,
    'mine' => $mine,
]);