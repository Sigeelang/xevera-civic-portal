<?php
header('Content-Type: application/json');
require_once __DIR__ . '/../config/cors.php';

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }
if ($_SERVER['REQUEST_METHOD'] !== 'POST') { http_response_code(405); echo json_encode(['error' => 'Method not allowed']); exit; }

/*
 * Step 1 of the OTP-protected password change.
 *
 * Validates the current/new passwords but does NOT touch the stored
 * password. Instead it issues a `password_change` OTP to the resident's
 * verified email using the existing otp_verifications table and the
 * existing Gmail mailer (same implementation as resend-otp.php).
 * The password is only updated by password_change_complete.php after
 * the code has been verified.
 */

require_once __DIR__ . '/../middleware/auth.php';
$user = requireAuth();

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/mailer.php';

$uid = (int)$user['user_id'];
$email = trim((string)($user['email'] ?? ''));
$input = json_decode(file_get_contents('php://input'), true) ?: [];
$current = trim((string)($input['current_password'] ?? ''));
$new = (string)($input['new_password'] ?? '');
$confirm = (string)($input['confirm_password'] ?? '');

try {

if (!$current || !$new || !$confirm) {
    http_response_code(400);
    echo json_encode(['error' => 'All password fields are required.']);
    exit;
}

$stmt = $pdo->prepare('SELECT name, email, password_hash FROM users WHERE id = ?');
$stmt->execute([$uid]);
$row = $stmt->fetch();

if (!$row || !password_verify($current, $row['password_hash'])) {
    http_response_code(400);
    echo json_encode(['error' => 'Current password is incorrect.']);
    exit;
}

$email = $email ?: trim((string)$row['email']);

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

$sent = false;

error_log("xevera_otp: purpose=password_change recipient={$email} otp_record_id={$otpId} insert=ok");

/*
 * Send unconditionally - same as the proven forgot.php flow. The old
 * MAIL_ENABLED gate meant the mail function never ran at all.
 */
$sent = xevera_mail($email, 'Confirm Your Password Change', $body);
error_log('xevera_otp: purpose=password_change xevera_mail=' . ($sent ? 'SUCCESS' : 'FAILED'));

// Never pretend the code was delivered - without a sent email the
// resident could never complete verification.
if (!$sent) {
    // Remove the unusable OTP record so it can't linger.
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
    /*
     * Any unexpected failure (PDO, SMTP, etc.) must still return valid
     * JSON - never a PHP fatal/HTML body the frontend cannot parse.
     * Log the reason server-side only; expose nothing sensitive.
     */
    error_log('xevera_otp: password_change_init exception: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => 'Unable to process your request. Please try again.',
    ]);
    exit;
}
