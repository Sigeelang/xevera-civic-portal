<?php
header('Content-Type: application/json');
require_once __DIR__ . '/../config/cors.php';

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }

require_once __DIR__ . '/../middleware/auth.php';
$user = requireAuth();
require_once __DIR__ . '/../config/database.php';

$uid = (int)$user['user_id'];
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $stmt = $pdo->prepare('SELECT account_prefs FROM users WHERE id = ?');
    $stmt->execute([$uid]);
    $raw = $stmt->fetchColumn();
    $prefs = $raw ? json_decode($raw, true) : [];
    if (!is_array($prefs)) $prefs = [];
    echo json_encode([
        'prefs' => array_merge([
            'language' => 'English',
            'theme' => 'light',
            'notify_report_updates' => true,
            'notify_tasks' => true,
            'notify_messages' => true,
            'notify_announcements' => true,
            'notify_email' => true,
            'notify_browser' => false,
            'compact_mode' => false,
            'sidebar_collapsed' => false,
            'timezone' => 'Asia/Manila (GMT+8)',
            'date_format' => 'MM/DD/YYYY',
            'time_format' => '12-hour (AM/PM)',
        ], $prefs),
    ]);
    exit;
}

if ($method === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true) ?: [];
    $newPrefs = isset($input['prefs']) && is_array($input['prefs']) ? $input['prefs'] : [];
    $allowed = ['language', 'theme', 'notify_report_updates', 'notify_tasks', 'notify_messages', 'notify_announcements', 'notify_email', 'notify_browser', 'compact_mode', 'sidebar_collapsed', 'timezone', 'date_format', 'time_format'];
    $sanitized = [];
    foreach ($allowed as $key) {
        if (array_key_exists($key, $newPrefs)) $sanitized[$key] = $newPrefs[$key];
    }
    $stmt = $pdo->prepare('SELECT account_prefs FROM users WHERE id = ?');
    $stmt->execute([$uid]);
    $raw = $stmt->fetchColumn();
    $existing = $raw ? json_decode($raw, true) : [];
    if (!is_array($existing)) $existing = [];
    $merged = array_merge($existing, $sanitized);

    $stmt = $pdo->prepare('UPDATE users SET account_prefs = ? WHERE id = ?');
    $stmt->execute([json_encode($merged), $uid]);

    $logStmt = $pdo->prepare('INSERT INTO activity_logs (user_id, action, target_type, target_id, detail) VALUES (?, ?, ?, ?, ?)');
    $logStmt->execute([$uid, 'update_preferences', 'user', $uid, 'Updated personal preferences']);

    echo json_encode(['success' => true, 'prefs' => $merged]);
    exit;
}
