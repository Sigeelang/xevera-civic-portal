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

$input = json_decode(file_get_contents('php://input'), true);
$token = trim($input['token'] ?? '');

if (!$token) {
    http_response_code(400);
    echo json_encode(['error' => 'Verification token is required.']);
    exit;
}

$stmt = $pdo->prepare('SELECT id, email_verified, verify_token, verify_token_expires FROM users WHERE verify_token = ?');
$stmt->execute([$token]);
$user = $stmt->fetch();

if (!$user || !$user['verify_token_expires'] || strtotime($user['verify_token_expires']) < time()) {
    http_response_code(400);
    echo json_encode(['error' => 'This verification link is invalid or has expired. Please request a new one.']);
    exit;
}

$stmt = $pdo->prepare('UPDATE users SET email_verified = 1, verify_token = NULL, verify_token_expires = NULL WHERE id = ?');
$stmt->execute([$user['id']]);

$logStmt = $pdo->prepare('INSERT INTO activity_logs (user_id, action, target_type, target_id, detail) VALUES (?, ?, ?, NULL, ?)');
$logStmt->execute([$user['id'], 'verify_email', 'auth', 'Email address verified']);

echo json_encode(['message' => 'Your email address has been verified.']);
