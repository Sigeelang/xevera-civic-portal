<?php
header('Content-Type: application/json');
require_once __DIR__ . '/../config/cors.php';

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }
if ($_SERVER['REQUEST_METHOD'] !== 'POST') { http_response_code(405); echo json_encode(['error' => 'Method not allowed']); exit; }

/*
 * Step 2 of the OTP-protected password change.
 *
 * Runs only AFTER the `password_change` OTP has been verified through
 * the existing verify-otp.php endpoint (which stamps verified_at).
 * The new password is supplied here and applied only now - never
 * before verification.
 */

require_once __DIR__ . '/../middleware/auth.php';
$user = requireAuth();

require_once __DIR__ . '/../config/database.php';

$uid = (int)$user['user_id'];
$email = trim((string)($user['email'] ?? ''));
$input = json_decode(file_get_contents('php://input'), true) ?: [];
$new = (string)($input['new_password'] ?? '');
$confirm = (string)($input['confirm_password'] ?? '');

if (!$new || !$confirm) {
    http_response_code(400);
    echo json_encode(['error' => 'New password and confirmation are required.']);
    exit;
}

if ($new !== $confirm) {
    http_response_code(400);
    echo json_encode(['error' => 'Passwords do not match.']);
    exit;
}

if (strlen($new) < 8 || !preg_match('/[A-Z]/', $new) || !preg_match('/[a-z]/', $new)
    || !preg_match('/[0-9]/', $new) || !preg_match('/[^A-Za-z0-9]/', $new)) {
    http_response_code(400);
    echo json_encode(['error' => 'Password must be at least 8 characters and include uppercase, lowercase, a number, and a special character.']);
    exit;
}

$stmt = $pdo->prepare('SELECT email FROM users WHERE id = ?');
$stmt->execute([$uid]);
$row = $stmt->fetch();

if (!$row) {
    http_response_code(404);
    echo json_encode(['error' => 'Account not found.']);
    exit;
}

$email = $email ?: trim((string)$row['email']);

/*
 * Accept either verified purpose:
 *   - password_change             normal change from profile / account page
 *   - password_change_first_login first-login set-password flow
 * Both are stamped by verify-otp.php only after the cryptographic check.
 */
$stmt = $pdo->prepare("SELECT id, purpose, expires_at, created_at FROM otp_verifications WHERE email = ? AND purpose IN ('password_change', 'password_change_first_login') AND verified_at IS NOT NULL ORDER BY created_at DESC LIMIT 1");
$stmt->execute([$email]);
$otp_record = $stmt->fetch();

if (!$otp_record) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid OTP. Please verify the code sent to your email first.']);
    exit;
}

if (strtotime($otp_record['expires_at']) < time()) {
    http_response_code(400);
    echo json_encode(['error' => 'OTP expired. Please request a new verification code.']);
    exit;
}

// Update the password only after successful OTP verification.
$hash = password_hash($new, PASSWORD_DEFAULT);
$stmt = $pdo->prepare('UPDATE users SET password_hash = ?, must_change_password = 0 WHERE id = ?');
$stmt->execute([$hash, $uid]);

// Invalidate this and any previous password-change OTPs (both purposes).
$stmt = $pdo->prepare("DELETE FROM otp_verifications WHERE email = ? AND purpose IN ('password_change', 'password_change_first_login')");
$stmt->execute([$email]);

$logStmt = $pdo->prepare('INSERT INTO activity_logs (user_id, action, target_type, detail) VALUES (?, ?, ?, NULL, ?)');
$logStmt->execute([$uid, 'change_password', 'user', 'Changed password via Gmail OTP verification']);

/*
 * OWASP: notify the user after a password change. Never include the
 * new password in the email - just a confirmation that it happened
 * and (if known) when/where.
 */
try {
    $name = trim((string)($row['name'] ?? ''));
    $siteName = getenv('APP_NAME') ?: 'Xevera Portal';
    $when = (new DateTimeImmutable('now', new DateTimeZone('Asia/Manila')))->format('M j, Y g:i A');
    $notify = "Hello {$name},\n\n"
        . "Your " . $siteName . " password was changed successfully on {$when} (Philippine time).\n\n"
        . "If you did not perform this change, please contact your administrator immediately so we can secure your account.\n\n"
        . "For your safety, the new password is not included in this email.";
    @xevera_mail($email, $siteName . ' - Password changed', $notify);
} catch (Throwable $e) {
    // Notification failure must never block the success response.
    error_log('xevera_password_change_complete notify: ' . $e->getMessage());
}

echo json_encode([
    'success' => true,
    'message' => 'Password changed successfully.',
]);
