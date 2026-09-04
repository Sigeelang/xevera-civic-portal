<?php
header('Content-Type: text/csv');
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
$stmt = $pdo->prepare('SELECT * FROM users WHERE id = ?');
$stmt->execute([$uid]);
$p = $stmt->fetch();

header('Content-Disposition: attachment; filename="profile_data.csv"');
echo "\xEF\xBB\xBF";
echo "Field,Value\n";
$rows = [
    'Name' => $p['name'] ?? '',
    'Username' => $p['username'] ?? '',
    'Email' => $p['email'] ?? '',
    'Role' => $p['role'] ?? '',
    'Status' => $p['status'] ?? '',
    'Address' => $p['address'] ?? '',
    'Phone' => $p['phone'] ?? '',
    'Gender' => $p['gender'] ?? '',
    'Date of Birth' => $p['date_of_birth'] ?? '',
    'Member Since' => $p['created_at'] ?? '',
    'Last Login' => $p['last_login_at'] ?? '',
];
foreach ($rows as $k => $v) {
    printf("%s,\"%s\"\n", $k, str_replace('"', '""', (string)$v));
}
exit;