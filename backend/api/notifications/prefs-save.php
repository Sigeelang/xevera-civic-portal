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

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../middleware/auth.php';

$user = requireRole(['Resident']);
$userId = (int)$user['user_id'];

$input = json_decode(file_get_contents('php://input'), true) ?: [];
$keys = ['notify_like', 'notify_comment', 'notify_status', 'notify_follow'];

$values = [];
foreach ($keys as $k) {
    $values[$k] = !empty($input[$k]) ? 1 : 0;
}

$stmt = $pdo->prepare('SELECT user_id FROM notification_prefs WHERE user_id = ?');
$stmt->execute([$userId]);
$exists = $stmt->fetch();

if ($exists) {
    $sets = implode(', ', array_map(fn($k) => "$k = ?", $keys));
    $pdo->prepare("UPDATE notification_prefs SET $sets WHERE user_id = ?")
        ->execute(array_merge(array_values($values), [$userId]));
} else {
    $pdo->prepare('INSERT INTO notification_prefs (user_id, notify_like, notify_comment, notify_status, notify_follow) VALUES (?, ?, ?, ?, ?)')
        ->execute(array_merge([$userId], array_values($values)));
}

echo json_encode(['message' => 'Preferences saved.', 'prefs' => $values]);