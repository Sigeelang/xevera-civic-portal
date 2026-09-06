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
$proofFilename = trim($input['proof_filename'] ?? '');

if (!$name || !$email || !$password) {
    http_response_code(400);
    echo json_encode(['error' => 'Name, email, and password are required.']);
    exit;
}

if (!$proofFilename) {
    http_response_code(400);
    echo json_encode(['error' => 'Proof of residency is required. Please upload a valid document.']);
    exit;
}

$proofPath = __DIR__ . '/../../uploads/residency/' . $proofFilename;
if (!file_exists($proofPath) || !preg_match('/^proof_[a-f0-9]{32}\.(jpg|jpeg|png|pdf)$/', $proofFilename)) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid proof of residency file. Please re-upload.']);
    exit;
}

if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    http_response_code(400);
    echo json_encode(['error' => 'Please enter a valid email address.']);
    exit;
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
$stmt = $pdo->prepare('INSERT INTO resident_registrations (name, username, email, password_hash, address) VALUES (?, ?, ?, ?, ?)');
$stmt->execute([$name, $username, $email, $hash, $address ?: null]);

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
$siteName = getenv('APP_NAME') ?: 'Xevera Portal';
$body = "Hello,\r\n\r\n"
    . "You requested a registration code for your {$siteName} account.\r\n\r\n"
    . "Your verification code: {$otp}\r\n\r\n"
    . "This code expires in 5 minutes. Do not share it with anyone.\r\n\r\n"
    . "If you didn't request this, you can safely ignore this email.\r\n\r\n"
    . " regards,\r\n"
    . "{$siteName} Team\r\n";

$sent = xevera_mail($email, 'Your Xevera Registration Code', $body);

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
