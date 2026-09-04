<?php
header('Content-Type: application/json');
require_once __DIR__ . '/../config/cors.php';

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }
if ($_SERVER['REQUEST_METHOD'] !== 'GET') { http_response_code(405); echo json_encode(['error' => 'Method not allowed']); exit; }

require_once __DIR__ . '/../middleware/auth.php';
requireRole(['Staff', 'Admin', 'Super Admin']);

require_once __DIR__ . '/../config/database.php';

$stmt = $pdo->query("SELECT workflow_status, COUNT(*) AS c FROM contact_messages GROUP BY workflow_status");
$counts = ['New' => 0, 'In Progress' => 0, 'Resolved' => 0, 'total' => 0];
foreach ($stmt->fetchAll() as $row) {
    $key = $row['workflow_status'] ?: 'New';
    $counts['total'] += (int)$row['c'];
    if (isset($counts[$key])) $counts[$key] = (int)$row['c'];
}

$stmt = $pdo->query("SELECT COUNT(*) FROM contact_messages WHERE status = 'new'");
$unread = (int)$stmt->fetchColumn();

echo json_encode([
    'counts' => $counts,
    'unread' => $unread,
]);