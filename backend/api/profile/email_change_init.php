<?php
header('Content-Type: application/json');
require_once __DIR__ . '/../config/cors.php';

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }
if ($_SERVER['REQUEST_METHOD'] !== 'POST') { http_response_code(405); echo json_encode(['error' => 'Method not allowed']); exit; }

/*
 * Step 1 of the OTP-protected email change.
 *
 * The new Gmail address is NOT applied here. An `email_change` OTP is
 * issued and sent to the NEW address using the existing OTP table and
 * the existing Gmail mailer. Only email_change_complete.php - after
 * verification through verify-otp.php - updates the account email.
 */

require_once __DIR__ . '/../middleware/auth.php';
$user = requireAuth();

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/mailer.php';
require_once __DIR__ . '/../config/email_templates.php';

$uid = (int)$user['user_id'];
$input = json_decode(file_get_contents('php://input'), true) ?: [];
$newEmail = strtolower(trim((string)($input['new_email'] ?? '')));

try {

$stmt = $pdo->prepare('SELECT name, email FROM users WHERE id = ?');
$stmt->execute([$uid]);
$row = $stmt->fetch();

if (!$row) {
    http_response_code(404);
    echo json_encode(['error' => 'Account not found.']);
    exit;
}

if (!$newEmail || !filter_var($newEmail, FILTER_VALIDATE_EMAIL)) {
    http_response_code(400);
    echo json_encode(['error' => 'Please enter a valid new Gmail address.']);
    exit;
}

$currentEmail = trim((string)$row['email']);
if (strcasecmp($newEmail, $currentEmail) === 0) {
    http_response_code(400);
    echo json_encode(['error' => 'The new email address is the same as your current one.']);
    exit;
}

$stmt = $pdo->prepare('SELECT id FROM users WHERE email = ? AND id != ?');
$stmt->execute([$newEmail, $uid]);
if ($stmt->fetch()) {
    http_response_code(409);
    echo json_encode(['error' => 'That email address is already registered.']);
    exit;
}

if ($pdo->query("SHOW TABLES LIKE 'otp_verifications'")->fetch() === false) {
    http_response_code(500);
    echo json_encode(['error' => 'Verification system is unavailable. Please try again later.']);
    exit;
}

// Issue the email_change OTP bound to the NEW address.
$purpose = 'email_change';

$stmt = $pdo->prepare('DELETE FROM otp_verifications WHERE email = ? AND purpose = ?');
$stmt->execute([$newEmail, $purpose]);

$otp = random_int(100000, 999999);
$otp_hash = hash('sha256', $otp);
$expires = date('Y-m-d H:i:s', time() + 300); // 5 minutes

$stmt = $pdo->prepare('
    INSERT INTO otp_verifications (email, otp_hash, purpose, expires_at, last_sent_at, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
');
$now = date('Y-m-d H:i:s');
$stmt->execute([$newEmail, $otp_hash, $purpose, $expires, $now, $now]);
$otpId = (int)$pdo->lastInsertId();

$otpStr = (string) $otp;
$recipientName = trim((string)($row['name'] ?? ''));
$plainBody = xevera_otp_email_text($otpStr, 'email_change', $recipientName);
$htmlBody = xevera_otp_email_html($otpStr, 'email_change', $recipientName);

$sent = false;

error_log("xevera_otp: purpose=email_change recipient={$newEmail} otp_record_id={$otpId} insert=ok");

// Send unconditionally - same as the proven forgot.php flow.
$sent = xevera_mail($newEmail, xevera_otp_subject('email_change'), $plainBody, $htmlBody);
error_log('xevera_otp: purpose=email_change xevera_mail=' . ($sent ? 'SUCCESS' : 'FAILED'));

// Never pretend the code was delivered.
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
    'message' => 'A verification code has been sent to your new email.',
    'email' => $newEmail,
]);

} catch (Throwable $e) {
    /*
     * Any unexpected failure must still return valid JSON. Log the
     * reason server-side only; expose nothing sensitive.
     */
    error_log('xevera_otp: email_change_init exception: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => 'Unable to process your request. Please try again.',
    ]);
    exit;
}
