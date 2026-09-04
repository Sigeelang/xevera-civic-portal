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
require_once __DIR__ . '/login_common.php';

/*
 * RESIDENT self-registration (pending-first).
 *
 * No `users` row is created here. The registration is stored in
 * `resident_registrations` and a `resident_register` OTP is emailed.
 * The account is created ONLY by auth/complete-registration.php after
 * the OTP is verified server-side. Staff/Admin/Super Admin flows are
 * untouched (see api/users/create.php).
 */

$input = json_decode(file_get_contents('php://input'), true);
$name = trim($input['name'] ?? '');
$password = $input['password'] ?? '';
$email = trim($input['email'] ?? '');
$address = trim($input['address'] ?? '');

if (!$name || !$email || !$password) {
    http_response_code(400);
    echo json_encode(['error' => 'Name, email, and password are required.']);
    exit;
}

if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    http_response_code(400);
    echo json_encode(['error' => 'Please enter a valid email address.']);
    exit;
}

/*
 * Enforce the same strength rules the Create Account form checks:
 * at least 8 characters, one number, one uppercase, one special character.
 */
$strong =
    strlen($password) >= 8
    && preg_match('/\d/', $password)
    && preg_match('/[A-Z]/', $password)
    && preg_match('/[^A-Za-z0-9]/', $password);

if (!$strong) {
    http_response_code(400);
    echo json_encode(['error' => 'Password must include at least 8 characters, one number, one uppercase letter, and one special character.']);
    exit;
}

if ($pdo->query("SHOW TABLES LIKE 'otp_verifications'")->fetch() === false
    || $pdo->query("SHOW TABLES LIKE 'resident_registrations'")->fetch() === false) {
    http_response_code(500);
    echo json_encode(['error' => 'Verification system is unavailable. Please try again later.']);
    exit;
}

// Duplicate email: an existing account blocks registration.
$stmt = $pdo->prepare('SELECT id FROM users WHERE email = ?');
$stmt->execute([$email]);
if ($stmt->fetch()) {
    http_response_code(409);
    echo json_encode(['error' => 'Email already registered.']);
    exit;
}

// Throttle OTP issuance (same policy as resend-otp.php).
if (xevera_otp_throttled($pdo, $email, 'resident_register')) {
    http_response_code(429);
    echo json_encode(['error' => 'Too many verification codes requested. Please wait a few minutes and try again.']);
    exit;
}

$username = strtolower(explode('@', $email)[0]);
$base = $username;
$suffix = 1;
while (true) {
    $stmt = $pdo->prepare('SELECT id FROM users WHERE username = ?');
    $stmt->execute([$username]);
    $takenByUser = (bool) $stmt->fetch();
    $stmt = $pdo->prepare('SELECT id FROM resident_registrations WHERE username = ? AND email <> ?');
    $stmt->execute([$username, $email]);
    $takenByPending = (bool) $stmt->fetch();
    if (!$takenByUser && !$takenByPending) break;
    $username = $base . '_' . $suffix;
    $suffix++;
}

$hash = password_hash($password, PASSWORD_DEFAULT);

try {
    // Upsert: one pending record per email, never duplicates.
    $stmt = $pdo->prepare('DELETE FROM resident_registrations WHERE email = ?');
    $stmt->execute([$email]);
    $stmt = $pdo->prepare('INSERT INTO resident_registrations (name, username, email, password_hash, address) VALUES (?, ?, ?, ?, ?)');
    $stmt->execute([$name, $username, $email, $hash, $address ?: null]);
} catch (PDOException $e) {
    http_response_code(409);
    echo json_encode(['error' => 'Email already registered.']);
    exit;
}

/*
 * Generate the registration OTP using the existing otp_verifications
 * table and send it through the existing Gmail mailer - the same
 * implementation used by resend-otp.php.
 */
$purpose = 'resident_register';

// Invalidate any previous codes for this email/purpose
$stmt = $pdo->prepare('DELETE FROM otp_verifications WHERE email = ? AND purpose = ?');
$stmt->execute([$email, $purpose]);

$otp = random_int(100000, 999999);
$otp_hash = hash('sha256', $otp);
$expires = date('Y-m-d H:i:s', time() + 600); // 10 minutes

$stmt = $pdo->prepare('
    INSERT INTO otp_verifications (email, otp_hash, purpose, expires_at, last_sent_at, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
');
$now = date('Y-m-d H:i:s');
$stmt->execute([$email, $otp_hash, $purpose, $expires, $now, $now]);
$otpId = (int)$pdo->lastInsertId();

$siteName = getenv('APP_NAME') ?: 'Xevera Portal';
$body = "Hello {$name},\n\n"
    . "Your registration code for " . $siteName . " is: {$otp}\n\n"
    . "This code expires in 10 minutes. Your account will be created after you enter this code.\n\n"
    . "If you didn't request this code, please ignore this email.\n";

// Send unconditionally - same as the proven forgot.php flow.
error_log("xevera_otp: purpose=resident_register recipient={$email} otp_record_id={$otpId} insert=ok");
$sent = xevera_mail($email, 'Your Xevera Registration Code', $body);
error_log('xevera_otp: purpose=resident_register xevera_mail=' . ($sent ? 'SUCCESS' : 'FAILED'));

if (!$sent) {
    // Fail closed on delivery bookkeeping but KEEP the pending record so
    // Resend OTP can retry delivery. Remove the unusable OTP row.
    $stmt = $pdo->prepare('DELETE FROM otp_verifications WHERE id = ?');
    $stmt->execute([$otpId]);

    try {
        $logStmt = $pdo->prepare('INSERT INTO activity_logs (user_id, action, target_type, detail) VALUES (NULL, ?, ?, ?)');
        $logStmt->execute(['register_pending', 'auth', 'Resident registration pending (email delayed) for: ' . $email]);
    } catch (Throwable $e) { /* log failure is non-fatal */ }
    echo json_encode([
        'success' => true,
        'pending' => true,
        'mail_sent' => false,
        'message' => 'Verification email is temporarily delayed due to high volume. Please check your Gmail (including Spam) in a few minutes, or tap Resend OTP. If it still does not arrive, contact support.',
        'email' => $email,
    ]);
    exit;
}

try {
    $logStmt = $pdo->prepare('INSERT INTO activity_logs (user_id, action, target_type, detail) VALUES (NULL, ?, ?, ?)');
    $logStmt->execute(['register_pending', 'auth', 'Resident registration pending for: ' . $email]);
} catch (Throwable $e) { /* log failure is non-fatal */ }

echo json_encode([
    'success' => true,
    'pending' => true,
    'mail_sent' => true,
    'message' => 'A verification code has been sent to your email. Your account will be created after verification.',
    'email' => $email,
    'from' => getenv('XEVERA_SMTP_FROM') ?: 'noreply@xevera.gov.ph',
    'subject' => 'Your Xevera Registration Code',
    'sent_at' => $now,
    'expires_at' => $expires,
    'resend_cooldown_seconds' => 60,
    'recipient_hint' => 'Search your Gmail for the sender "' . (getenv('XEVERA_SMTP_FROM') ?: 'noreply@xevera.gov.ph') . '" or the subject "Your Xevera Registration Code". The code is also valid for 10 minutes.',
]);
