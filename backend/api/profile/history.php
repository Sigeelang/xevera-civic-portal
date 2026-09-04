<?php
header('Content-Type: application/json');
require_once __DIR__ . '/../config/cors.php';

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

require_once __DIR__ . '/../middleware/auth.php';
$user = requireAuth();
require_once __DIR__ . '/../config/database.php';

$uid = (int)$user['user_id'];
$stmt = $pdo->prepare('SELECT * FROM login_history WHERE user_id = ? ORDER BY created_at DESC LIMIT 100');
$stmt->execute([$uid]);
$items = $stmt->fetchAll();

$download = ($_GET['download'] ?? '') === 'csv';
if ($download) {
    header('Content-Type: text/csv');
    header('Content-Disposition: attachment; filename="login_history.csv"');
    echo "\xEF\xBB\xBF";
    echo "Date,Time,Browser,OS,Device,IP,Location,Status\n";
    foreach ($items as $r) {
        $dt = $r['created_at'];
        printf("%s,%s,%s,%s,%s,%s,%s,OK\n",
            date('Y-m-d', strtotime($dt)), date('H:i:s', strtotime($dt)),
            ($r['browser'] ?: ''), ($r['os'] ?: ''), ($r['device'] ?: ''),
            ($r['ip'] ?: ''), ($r['location'] ?: ''));
    }
    exit;
}

echo json_encode(['items' => $items, 'total' => count($items)]);