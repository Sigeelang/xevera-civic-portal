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

/*
 * REGISTRATION WITH OTP VERIFICATION.
 *
 * Step 1 (this endpoint): Validate form, store in resident_registrations,
 *   generate OTP, send email. Returns pending: true.
 * Step 2: User enters OTP → verify-otp.php (purpose resident_register).
 * Step 3: complete-registration.php creates the user with
 *   status=Inactive, residency_status=Pending Verification.
 */

$input = json_decode(file_get_contents('php://input'), true);
$name = trim($input['name'] ?? '');
$password = $input['password'] ?? '';
$email = trim($input['email'] ?? '');
$address = trim($input['address'] ?? '');
$phone = trim($input['phone'] ?? '');
$proofFilenames = [];
try {
    require_once __DIR__ . '/proof_validate.php';
    $proofFilenames = xevera_validate_proof_list($input);
} catch (RuntimeException $e) {
    http_response_code(400);
    echo json_encode(['error' => $e->getMessage()]);
    exit;
}

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

// Phone is optional, but when provided must be a valid PH mobile
// (09XXXXXXXXX, 11 digits) and fit the column. Normalization mirrors
// frontend normalizePhMobile().
if ($phone !== '') {
    $phoneDigits = preg_replace('/\D/', '', $phone);
    $phoneDigits = preg_replace('/^0+/', '', $phoneDigits);
    if (str_starts_with($phoneDigits, '63')) $phoneDigits = substr($phoneDigits, 2);
    if ($phoneDigits !== '' && $phoneDigits[0] === '9') $phoneDigits = '0' . $phoneDigits;
    elseif ($phoneDigits !== '' && !str_starts_with($phoneDigits, '09')) $phoneDigits = '09' . $phoneDigits;
    $phoneDigits = substr($phoneDigits, 0, 11);
    if (!preg_match('/^09\d{9}$/', $phoneDigits)) {
        http_response_code(400);
        echo json_encode(['error' => 'Please enter a valid mobile number (09XXXXXXXXX).']);
        exit;
    }
    $phone = $phoneDigits;
}

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

// Throttle registrations.
if (xevera_otp_throttled($pdo, $email, 'resident_register')) {
    http_response_code(429);
    echo json_encode(['error' => 'Too many registration attempts. Please wait a few minutes and try again.']);
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

// Store in staging table (user is NOT created yet).
$stmt = $pdo->prepare('DELETE FROM resident_registrations WHERE email = ?');
$stmt->execute([$email]);
try {
    $hasPhoneCol = (bool)$pdo->query("SHOW COLUMNS FROM resident_registrations LIKE 'phone'")->fetch();
} catch (Throwable $e) {
    $hasPhoneCol = false;
}
if ($hasPhoneCol) {
    $stmt = $pdo->prepare('INSERT INTO resident_registrations (name, username, email, password_hash, address, phone) VALUES (?, ?, ?, ?, ?, ?)');
    $stmt->execute([$name, $username, $email, $hash, $address ?: null, $phone !== '' ? $phone : null]);
} else {
    $stmt = $pdo->prepare('INSERT INTO resident_registrations (name, username, email, password_hash, address) VALUES (?, ?, ?, ?, ?)');
    $stmt->execute([$name, $username, $email, $hash, $address ?: null]);
}

// Generate OTP and send email.
$otp = random_int(100000, 999999);
$otp_hash = hash('sha256', $otp);
$expires = date('Y-m-d H:i:s', time() + 300); // 5 minutes
$purpose = 'resident_register';

// Invalidate previous OTPs for same email+purpose.
$stmt = $pdo->prepare('DELETE FROM otp_verifications WHERE email = ? AND purpose = ?');
$stmt->execute([$email, $purpose]);

$now = date('Y-m-d H:i:s');
$stmt = $pdo->prepare('INSERT INTO otp_verifications (email, otp_hash, purpose, expires_at, last_sent_at, created_at) VALUES (?, ?, ?, ?, ?, NOW())');
$stmt->execute([$email, $otp_hash, $purpose, $expires, $now]);

xevera_dev_otp_record($pdo, $email, $purpose, (string) $otp, $expires);

// Send OTP email.
$otpStr = (string) $otp;
$plainBody = xevera_otp_email_text($otpStr, 'resident_register', $name);
$htmlBody = xevera_otp_email_html($otpStr, 'resident_register', $name);

$sent = xevera_mail($email, xevera_otp_subject('resident_register'), $plainBody, $htmlBody);

// Count successful sends for analytics (non-fatal).
if ($sent) {
    try {
        $pdo->prepare("INSERT INTO activity_logs (user_id, action, target_type, target_id, detail) VALUES (NULL, 'otp_sent', 'auth', NULL, ?)")->execute(['OTP sent (resident_register) to ' . $email]);
    } catch (Throwable $e) { /* analytics must never break registration */ }
}

if (!$sent) {
    // Email delivery failed, but registration and OTP exist.
    // Return pending: true so frontend shows OTP page (dev-otp.php works).
    echo json_encode([
        'success' => true,
        'pending' => true,
        'mail_sent' => false,
        'message' => 'Verification email delayed. You can still verify using the code.',
        'email' => $email,
    ]);
    exit;
}

echo json_encode([
    'success' => true,
    'pending' => true,
    'mail_sent' => true,
    'message' => 'We sent a verification code to your email.',
    'email' => $email,
]);
