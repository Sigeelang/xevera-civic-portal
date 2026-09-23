<?php
header('Content-Type: application/json');
require_once __DIR__ . '/../config/cors.php';

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }
if ($_SERVER['REQUEST_METHOD'] !== 'POST') { http_response_code(405); echo json_encode(['error' => 'Method not allowed']); exit; }

require_once __DIR__ . '/../middleware/auth.php';
$user = requireAuth();

require_once __DIR__ . '/../config/database.php';

$uid = (int)$user['user_id'];
$input = json_decode(file_get_contents('php://input'), true) ?: [];
$current = trim((string)($input['current_password'] ?? ''));
$new = (string)($input['new_password'] ?? '');
$confirm = (string)($input['confirm_password'] ?? '');

if (!$current || !$new || !$confirm) {
    http_response_code(400);
    echo json_encode(['error' => 'All password fields are required.']);
    exit;
}

if ($new !== $confirm) {
    http_response_code(400);
    echo json_encode(['error' => 'New password and confirmation do not match.']);
    exit;
}

if (strlen($new) < 8 || !preg_match('/[A-Z]/', $new) || !preg_match('/[a-z]/', $new)
    || !preg_match('/[0-9]/', $new) || !preg_match('/[^A-Za-z0-9]/', $new)) {
    http_response_code(400);
    echo json_encode(['error' => 'Password must be at least 8 characters and include uppercase, lowercase, a number, and a special character.']);
    exit;
}

$stmt = $pdo->prepare('SELECT email, password_hash FROM users WHERE id = ?');
$stmt->execute([$uid]);
$row = $stmt->fetch();

if (!$row || !password_verify($current, $row['password_hash'])) {
    http_response_code(400);
    echo json_encode(['error' => 'Current password is incorrect.']);
    exit;
}

/* Reuse guard: the new password must differ from the current one. */
if (password_verify($new, $row['password_hash'])) {
    http_response_code(400);
    echo json_encode(['error' => 'New password must be different from your current password.']);
    exit;
}

/*
 * OTP ENFORCEMENT: this legacy direct-change endpoint must never bypass
 * the OTP-protected flow. A password_change (or first-login) code has to
 * have been verified via verify-otp.php for this account first.
 */
$otpEmail = trim((string)$row['email']);
$otpCheck = $pdo->prepare("SELECT id FROM otp_verifications WHERE email = ? AND purpose IN ('password_change', 'password_change_first_login') AND verified_at IS NOT NULL AND expires_at >= NOW() ORDER BY created_at DESC LIMIT 1");
$otpCheck->execute([$otpEmail]);
$verifiedOtp = $otpCheck->fetch();

if (!$verifiedOtp) {
    http_response_code(400);
    echo json_encode(['error' => 'Verification required. Please request a code before changing your password.']);
    exit;
}

$hash = password_hash($new, PASSWORD_DEFAULT);
$stmt = $pdo->prepare('UPDATE users SET password_hash = ?, must_change_password = 0 WHERE id = ?');
$stmt->execute([$hash, $uid]);

// Consume the verified OTP so it cannot be reused.
$stmt = $pdo->prepare("DELETE FROM otp_verifications WHERE email = ? AND purpose IN ('password_change', 'password_change_first_login')");
$stmt->execute([$otpEmail]);

$logStmt = $pdo->prepare('INSERT INTO activity_logs (user_id, action, target_type, target_id, detail) VALUES (?, ?, ?, NULL, ?)');
$logStmt->execute([$uid, 'change_password', 'user', 'Changed password (OTP verified)']);

echo json_encode(['success' => true]);