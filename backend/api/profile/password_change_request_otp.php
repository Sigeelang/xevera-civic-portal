<?php
header('Content-Type: application/json');
require_once __DIR__ . '/../config/cors.php';

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }
if ($_SERVER['REQUEST_METHOD'] !== 'POST') { http_response_code(405); echo json_encode(['error' => 'Method not allowed']); exit; }

/*
 * OTP-first password change flow.
 *
 * Step 1: Send a password_change OTP to the authenticated user's email.
 * No password validation here - the OTP itself proves identity.
 * Step 2: verify-otp.php verifies the code.
 * Step 3: password_change_complete.php applies the new password.
 */

require_once __DIR__ . '/../middleware/auth.php';
$user = requireAuth();

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/mailer.php';

$uid = (int)$user['user_id'];
$email = trim((string)($user['email'] ?? ''));

try {

$stmt = $pdo->prepare('SELECT name, email FROM users WHERE id = ?');
$stmt->execute([$uid]);
$row = $stmt->fetch();

if (!$row) {
    http_response_code(404);
    echo json_encode(['error' => 'Account not found.']);
    exit;
}

$email = $email ?: trim((string)$row['email']);

if ($pdo->query("SHOW TABLES LIKE 'otp_verifications'")->fetch() === false) {
    http_response_code(500);
    echo json_encode(['error' => 'Verification system is unavailable. Please try again later.']);
    exit;
}

// Issue the password_change OTP (invalidates any previous one).
$purpose = 'password_change';

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

$siteName = getenv('APP_NAME') ?: 'Xevera Portal';
$name = $row['name'];
$body = "Hello {$name},\n\n"
    . "We received a request to change your " . $siteName . " account password.\n"
    . "Your verification code is: {$otp}\n\n"
    . "This code expires in 5 minutes. Your password will only be changed after you enter this code.\n\n"
    . "If you didn't request this change, please ignore this email.\n";

error_log("xevera_otp: purpose=password_change recipient={$email} otp_record_id={$otpId} insert=ok");

$sent = xevera_mail($email, 'Confirm Your Password Change', $body);
error_log('xevera_otp: purpose=password_change xevera_mail=' . ($sent ? 'SUCCESS' : 'FAILED'));

if (!$sent) {
    $stmt = $pdo->prepare('DELETE FROM otp_verifications WHERE id = ?');
    $stmt->execute([$otpId]);

    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => 'Unable to send the verification code. Please try again.',
    ]);
    exit;
}

echo json_encode([
    'success' => true,
    'message' => 'A verification code has been sent to your email.',
    'email' => $email,
]);

} catch (Throwable $e) {
    error_log('xevera_otp: password_change_request_otp exception: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => 'Unable to process your request. Please try again.',
    ]);
    exit;
}
