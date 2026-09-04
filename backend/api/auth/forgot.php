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

$input = json_decode(file_get_contents('php://input'), true);
$email = trim($input['email'] ?? '');
$purpose = $input['purpose'] ?? 'resident_password_reset';

if (!in_array($purpose, ['resident_register', 'resident_password_reset'], true)) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid verification purpose.']);
    exit;
}

if (!$email || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
    http_response_code(400);
    echo json_encode(['error' => 'A valid email address is required.']);
    exit;
}

// Check if user exists and is active for resident flows
$stmt = $pdo->prepare('SELECT id, name, email, status FROM users WHERE email = ?');
$stmt->execute([$email]);
$user = $stmt->fetch();

if (!$user) {
    // For registration: allow sending OTP even if user doesn't exist yet (will create on verification)
    // For password reset: don't reveal if account exists
    if ($purpose === 'resident_register') {
        // Generate OTP for new registration
    } else {
        http_response_code(400);
        echo json_encode(['error' => 'If an account exists for that email, a reset link will be available.']);
        exit;
    }
}

// Generate 6-digit OTP
if (xevera_otp_throttled($pdo, $email, $purpose)) {
    http_response_code(429);
    echo json_encode(['error' => 'Too many verification codes requested. Please wait a few minutes and try again.']);
    exit;
}

$otp = random_int(100000, 999999);
$otp_hash = hash('sha256', $otp);
$expires = date('Y-m-d H:i:s', time() + 300); // 5 minutes
$now = date('Y-m-d H:i:s');

// Handle existing OTP - invalidate previous ones for same email and purpose
$stmt = $pdo->prepare('DELETE FROM otp_verifications WHERE email = ? AND purpose = ?');
$stmt->execute([$email, $purpose]);

// Insert new OTP
$stmt = $pdo->prepare('
    INSERT INTO otp_verifications (email, otp_hash, purpose, expires_at, created_at) 
    VALUES (?, ?, ?, ?, NOW())
');
$stmt->execute([$email, $otp_hash, $purpose, $expires]);
xevera_dev_otp_record($pdo, $email, $purpose, (string) $otp, $expires);

// Send OTP via email
$siteName = getenv('APP_NAME') ?: 'Xevera Portal';
$body = "Hello,\n\n"
    . "Your " . ($purpose === 'resident_register' ? 'registration' : 'password reset') . " code for " . $siteName . " is: $otp\n\n"
    . "This code expires in 10 minutes.\n\n"
    . "If you didn't request this, please ignore this email.\n";

// Send via Gmail SMTP. Fail closed - never expose the OTP.
$sent = xevera_mail($user['email'] ?? $email, $purpose === 'resident_register' ? 'Your Xevera Registration Code' : 'Your Password Reset Code', $body);

if (!$sent) {
    // Remove the unusable code so it cannot be retried into validity.
    $stmt = $pdo->prepare('DELETE FROM otp_verifications WHERE email = ? AND purpose = ?');
    $stmt->execute([$email, $purpose]);

    http_response_code(500);
    echo json_encode([
        'error' => 'Unable to send verification code.',
        'purpose' => $purpose,
    ]);
    exit;
}

echo json_encode([
    'message' => 'Your verification code has been sent.',
    'purpose' => $purpose,
]);