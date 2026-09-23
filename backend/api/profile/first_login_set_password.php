<?php
header('Content-Type: application/json');
require_once __DIR__ . '/../config/cors.php';

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }
if ($_SERVER['REQUEST_METHOD'] !== 'POST') { http_response_code(405); echo json_encode(['error' => 'Method not allowed']); exit; }

/*
 * First-login password set — STEP 1 (OTP request only).
 *
 * The new password is NOT applied here. This endpoint validates it,
 * issues a `password_change_first_login` OTP, and emails the code.
 * The password is applied only by password_change_complete.php AFTER
 * verify-otp.php has stamped verified_at for this email + purpose.
 *
 * Fails closed: if the code cannot be emailed, the OTP record is removed
 * and the request errors, so a first-login user can never reach the
 * dashboard with an unverified password change.
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

if (strlen($new) < 8 || !preg_match('/[A-Z]/', $new) || !preg_match('/[a-z]/', $new)
    || !preg_match('/[0-9]/', $new) || !preg_match('/[^A-Za-z0-9]/', $new)) {
    http_response_code(400);
    echo json_encode(['error' => 'Password must be at least 8 characters and include uppercase, lowercase, a number, and a special character.']);
    exit;
}

$stmt = $pdo->prepare('SELECT name, email, password_hash FROM users WHERE id = ?');
$stmt->execute([$uid]);
$row = $stmt->fetch();

if (!$row) {
    http_response_code(404);
    echo json_encode(['error' => 'Account not found.']);
    exit;
}

/* Reuse guard: the new password must differ from the current one. */
if (!empty($row['password_hash']) && password_verify($new, $row['password_hash'])) {
    http_response_code(400);
    echo json_encode(['error' => 'New password must be different from your current password.']);
    exit;
}

$email = trim((string)$row['email']);
$name = trim((string)$row['name']);

if ($pdo->query("SHOW TABLES LIKE 'otp_verifications'")->fetch() === false) {
    http_response_code(500);
    echo json_encode(['error' => 'Verification system is unavailable. Please try again later.']);
    exit;
}

// Issue the first-login OTP (invalidates any previous one).
$purpose = 'password_change_first_login';

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

$otpStr = (string) $otp;
$plainBody = xevera_otp_email_text($otpStr, 'password_change_first_login', $name);
$htmlBody = xevera_otp_email_html($otpStr, 'password_change_first_login', $name);

$sent = xevera_mail($email, xevera_otp_subject('password_change_first_login'), $plainBody, $htmlBody);
error_log("xevera_otp: purpose=password_change_first_login recipient={$email} otp_record_id={$otpId} sent=" . ($sent ? 'SUCCESS' : 'FAILED'));

if (!$sent) {
    // Fail closed: no usable code means no verification is possible.
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
    'email_sent' => true,
    'message' => 'A verification code has been sent to your email.',
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
