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
require_once __DIR__ . '/../config/mailer.php';
require_once __DIR__ . '/../config/email_templates.php';
require_once __DIR__ . '/login_common.php';

$input = json_decode(file_get_contents('php://input'), true);
$email = trim($input['email'] ?? '');
$purpose = $input['purpose'] ?? 'resident_password_reset';

$allowed_purposes = ['resident_register', 'resident_password_reset', 'password_change', 'password_change_first_login', 'email_change', 'login_2fa'];
if (!in_array($purpose, $allowed_purposes, true)) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid verification purpose.']);
    exit;
}

if (!$email || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
    http_response_code(400);
    echo json_encode(['error' => 'A valid email address is required.']);
    exit;
}

// Check cooldown - if OTP was sent less than 60 seconds ago, don't resend
$stmt = $pdo->prepare('SELECT last_sent_at FROM otp_verifications WHERE email = ? AND purpose = ? ORDER BY created_at DESC LIMIT 1');
$stmt->execute([$email, $purpose]);
$last_otp = $stmt->fetch();

if ($last_otp && $last_otp['last_sent_at']) {
    $lastSent = strtotime($last_otp['last_sent_at']);
    $now = time();
    $cooldown = 60; // 60 seconds
    if ($now - $lastSent < $cooldown) {
        $remaining = $cooldown - ($now - $lastSent);
        http_response_code(429);
        echo json_encode([
            'error' => 'Please wait ' . ceil($remaining) . ' more seconds before resending the OTP.',
            'remaining_seconds' => $remaining
        ]);
        exit;
    }
}

if (xevera_otp_throttled($pdo, $email, $purpose)) {
    http_response_code(429);
    echo json_encode(['error' => 'Too many verification codes requested. Please wait a few minutes and try again.']);
    exit;
}

// Delete existing OTPs for this email and purpose (invalidate previous)
$stmt = $pdo->prepare('DELETE FROM otp_verifications WHERE email = ? AND purpose = ?');
$stmt->execute([$email, $purpose]);

// Generate new 6-digit OTP
$otp = random_int(100000, 999999);
$otp_hash = hash('sha256', $otp);
$expires = date('Y-m-d H:i:s', time() + 600); // 10 minutes

// Insert new OTP
$stmt = $pdo->prepare('
    INSERT INTO otp_verifications (email, otp_hash, purpose, expires_at, last_sent_at, created_at) 
    VALUES (?, ?, ?, ?, ?, ?)
');
$now = date('Y-m-d H:i:s');
$stmt->execute([$email, $otp_hash, $purpose, $expires, $now, $now]);
xevera_dev_otp_record($pdo, $email, $purpose, (string) $otp, $expires);

// Send OTP via email
$siteName = getenv('APP_NAME') ?: 'Xevera Portal';
$otpStr = (string) $otp;
$purposeLabel = 'verification';
$plainBody = xevera_otp_email_text($otpStr, $purposeLabel);
$htmlBody = xevera_otp_email_html($otpStr, $purposeLabel);

$sent = false;
$devOtp = null;

error_log("xevera_otp: resend purpose={$purpose} recipient={$email}");

/*
 * Send unconditionally - same as the proven forgot.php flow.
 */
$userStmt = $pdo->prepare('SELECT name, email FROM users WHERE email = ?');
$userStmt->execute([$email]);
$user = $userStmt->fetch();

if ($user) {
    $subject = $purpose === 'login_2fa'
        ? 'Your Xevera Login Verification Code'
        : ($purpose === 'resident_register'
            ? 'Your Xevera Registration Code'
            : ($purpose === 'password_change' ? 'Confirm Your Password Change' : 'Your Xevera Verification Code'));
    $sent = xevera_mail($user['email'], $subject, $plainBody, $htmlBody);
} else {
    // No account row yet (registration or pending email change):
    // send directly to the provided address instead of skipping.
    $subject = $purpose === 'resident_register'
        ? 'Your Xevera Registration Code'
        : ($purpose === 'email_change' ? 'Confirm Your New Xevera Email' : 'Your Xevera Verification Code');
    $sent = xevera_mail($email, $subject, $plainBody, $htmlBody);
}

error_log('xevera_otp: resend purpose=' . $purpose . ' xevera_mail=' . ($sent ? 'SUCCESS' : 'FAILED'));

if (!$sent) {
    $queued = function_exists('xevera_mail_queue_count') ? xevera_mail_queue_count() : 0;
    if ($queued > 0) {
        echo json_encode([
            'success' => true,
            'queued' => true,
            'message' => 'Verification email is temporarily delayed due to high volume. Please check your Gmail (including Spam) in a few minutes, or tap Resend OTP. If it still does not arrive, contact support.',
            'purpose' => $purpose,
        ]);
        exit;
    }
    // Keep the OTP record so the user can retry again.
    error_log('xevera_otp: resend email_send_failed keeping OTP for retry purpose=' . $purpose . ' email=' . $email);

    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => 'Unable to send the verification code. Please try again.',
        'purpose' => $purpose,
    ]);
    exit;
}

echo json_encode([
    'success' => true,
    'message' => 'A new verification code has been sent.',
    'purpose' => $purpose,
]);