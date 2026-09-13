<?php
header('Content-Type: application/json');
require_once __DIR__ . '/../config/cors.php';

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }
if ($_SERVER['REQUEST_METHOD'] !== 'POST') { http_response_code(405); echo json_encode(['error' => 'Method not allowed']); exit; }

/*
 * First-login password set + OTP send.
 *
 * Flow:
 *   1. User sets new password (no current password required).
 *   2. Password is updated immediately.
 *   3. An OTP is sent to the user's email for verification.
 *   4. Frontend shows OTP screen.
 *   5. User verifies OTP via verify-otp.php (purpose=password_change_first_login).
 */

require_once __DIR__ . '/../middleware/auth.php';
$user = requireAuth();

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/mailer.php';
require_once __DIR__ . '/../config/email_templates.php';

$uid = (int)$user['user_id'];
$input = json_decode(file_get_contents('php://input'), true) ?: [];
$new = (string)($input['new_password'] ?? '');
$confirm = (string)($input['confirm_password'] ?? '');

try {

if (!$new || !$confirm) {
    http_response_code(400);
    echo json_encode(['error' => 'All password fields are required.']);
    exit;
}

if ($new !== $confirm) {
    http_response_code(400);
    echo json_encode(['error' => 'New password and confirmation do not match.']);
    exit;
}

if (strlen($new) < 12 || !preg_match('/[A-Z]/', $new) || !preg_match('/[a-z]/', $new)
    || !preg_match('/[0-9]/', $new) || !preg_match('/[^A-Za-z0-9]/', $new)) {
    http_response_code(400);
    echo json_encode(['error' => 'Password must be at least 12 characters and include uppercase, lowercase, a number, and a special character.']);
    exit;
}

$stmt = $pdo->prepare('SELECT name, email FROM users WHERE id = ?');
$stmt->execute([$uid]);
$row = $stmt->fetch();

if (!$row) {
    http_response_code(404);
    echo json_encode(['error' => 'Account not found.']);
    exit;
}

$email = trim((string)$row['email']);
$name = trim((string)$row['name']);

// Update password immediately (first login — no current password check)
$hash = password_hash($new, PASSWORD_DEFAULT);
$stmt = $pdo->prepare('UPDATE users SET password_hash = ?, must_change_password = 0 WHERE id = ?');
$stmt->execute([$hash, $uid]);

// Generate and send OTP for email verification
$purpose = 'password_change_first_login';

// Invalidate any previous OTPs for this purpose
$stmt = $pdo->prepare('DELETE FROM otp_verifications WHERE email = ? AND purpose = ?');
$stmt->execute([$email, $purpose]);

$otp = random_int(100000, 999999);
$otp_hash = hash('sha256', $otp);
$expires = date('Y-m-d H:i:s', time() + 300); // 5 minutes

$stmt = $pdo->prepare('
    INSERT INTO otp_verifications (email, otp_hash, purpose, expires_at, last_sent_at, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
');
$now = date('Y-m-d H:i:s');
$stmt->execute([$email, $otp_hash, $purpose, $expires, $now, $now]);
$otpId = (int)$pdo->lastInsertId();

// Send OTP email using HTML template
$otpStr = (string) $otp;
$otpPurposeLabel = 'email verification';
$plainBody = xevera_otp_email_text($otpStr, $otpPurposeLabel);
$htmlBody = xevera_otp_email_html($otpStr, $otpPurposeLabel);

$sent = xevera_mail($email, 'Xevera Portal - Email Verification Code', $plainBody, $htmlBody);
error_log("xevera_otp: purpose=password_change_first_login recipient={$email} otp_record_id={$otpId} sent=" . ($sent ? 'SUCCESS' : 'FAILED'));

if (!$sent) {
    // OTP record is kept so the user can retry via Resend OTP.
    error_log("xevera_otp: purpose=password_change_first_login recipient={$email} email_send_failed - OTP retained for resend");

    // Password IS updated and must_change_password=0. Return
    // password_updated=true and email_sent=false so the frontend clears
    // forcePwChange and skips the OTP step. Email verification can be
    // completed later from profile settings.
    echo json_encode([
        'success' => true,
        'password_updated' => true,
        'email_sent' => false,
        'message' => 'Password updated. Email verification will be available from your profile.',
        'email' => $email,
    ]);
    exit;
}

echo json_encode([
    'success' => true,
    'password_updated' => true,
    'email_sent' => true,
    'message' => 'Password updated. A verification code has been sent to your email.',
    'email' => $email,
]);

} catch (Throwable $e) {
    error_log('xevera_first_login_set_password exception: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => 'Unable to process your request. Please try again.',
    ]);
    exit;
}
