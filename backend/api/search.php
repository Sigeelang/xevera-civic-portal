<?php
header('Content-Type: application/json');
require_once __DIR__ . '/config/cors.php';

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

require_once __DIR__ . '/middleware/auth.php';

$payload = token_payload();
$isStaff = $payload && in_array($payload['role'] ?? '', ['Admin', 'Super Admin', 'Staff'], true);

require_once __DIR__ . '/config/database.php';
require_once __DIR__ . '/middleware/write_ratelimit.php';
xevera_write_rate_limit($pdo, 'search.public');

$q = trim($_GET['q'] ?? '');
if ($q === '') {
    echo json_encode(['reports' => [], 'residents' => [], 'announcements' => []]);
    exit;
}

// Escape LIKE wildcards so %/_ search literally instead of matching everything.
$like = '%' . addcslashes($q, '%_\\') . '%';

// reports
$stmt = $pdo->prepare("
    SELECT r.ref_id, r.title, r.category, r.status, r.priority, r.created_at, r.location
    FROM reports r
    WHERE r.title LIKE ? OR r.location LIKE ? OR r.ref_id LIKE ? OR r.description LIKE ?
    ORDER BY r.created_at DESC LIMIT 6
");
$stmt->execute([$like, $like, $like, $like]);
$reports = array_map(function ($r) {
    return [
        'id' => $r['ref_id'],
        'title' => $r['title'],
        'category' => $r['category'],
        'status' => $r['status'],
        'priority' => $r['priority'],
        'location' => $r['location'],
        'date' => date('M j, Y', strtotime($r['created_at'])),
    ];
}, $stmt->fetchAll());

// residents (staff only)
$residents = [];
if ($isStaff) {
    $stmt = $pdo->prepare("
        SELECT id, name, username, email, address, status
        FROM users
        WHERE role = 'Resident' AND (name LIKE ? OR username LIKE ? OR email LIKE ? OR address LIKE ?)
        ORDER BY name LIMIT 6
    ");
    $stmt->execute([$like, $like, $like, $like]);
    $residents = array_map(function ($u) {
        return [
            'id' => (int)$u['id'],
            'name' => $u['name'],
            'username' => $u['username'],
            'email' => $u['email'],
            'address' => $u['address'] ?? '',
            'status' => $u['status'],
        ];
    }, $stmt->fetchAll());
}

// announcements
$stmt = $pdo->prepare("
    SELECT id, title, category, status, created_at
    FROM announcements
    WHERE title LIKE ? OR content LIKE ?
    ORDER BY created_at DESC LIMIT 6
");
$stmt->execute([$like, $like]);
$announcements = array_map(function ($a) {
    return [
        'id' => (int)$a['id'],
        'title' => $a['title'],
        'category' => $a['category'],
        'status' => $a['status'],
        'date' => date('M j, Y', strtotime($a['created_at'])),
    ];
}, $stmt->fetchAll());

echo json_encode([
    'reports' => $reports,
    'residents' => $residents,
    'announcements' => $announcements,
]);