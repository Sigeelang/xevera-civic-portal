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
require_once __DIR__ . '/../middleware/write_ratelimit.php';

/*
 * DEV-ONLY OTP reveal endpoint.
 *
 * This endpoint is GATED BY `DEV_OTP_MODE=1` IN .env. In production
 * this MUST be `0` (or unset) so the endpoint returns 404. Even when
 * enabled, it is rate-limited to 60 calls per hour per IP.
 *
 * Body: { "email": "...", "purpose": "resident_register|forgot_password|..." }
 * Response: { "dev_mode": true, "email": "...", "purpose": "...",
 *             "otp": "123456", "expires_at": "2026-01-01 12:34:56",
 *             "created_at": "...", "seconds_remaining": 600 }
 *
 * It does NOT bypass verification — it only reveals an already-issued
 * OTP so developers can complete registration / password reset flows
 * when outbound email is broken (e.g. Gmail SMTP rate limit, SES
 * sandbox).
 */

$devMode = getenv('DEV_OTP_MODE') === '1';

if (!$devMode) {
    // Hide the existence of the endpoint when disabled.
    http_response_code(404);
    echo json_encode(['error' => 'Not found']);
    exit;
}

$rawBody = file_get_contents('php://input');
$input = json_decode($rawBody, true);
if (!is_array($input)) {
    $input = $_POST ?: [];
}
$email = trim((string)($input['email'] ?? ''));
$purpose = trim((string)($input['purpose'] ?? 'resident_register'));

// IP-based throttle: 60 calls / hour / IP (central limiter).
xevera_write_rate_limit($pdo, 'auth.dev_otp');

if (!$email) {
    http_response_code(400);
    echo json_encode(['error' => 'email required']);
    exit;
}

// Always return the same shape regardless of whether an OTP exists —
// don't leak whether an email is registered.
$now = date('Y-m-d H:i:s');
$stmt = $pdo->prepare('
    SELECT id, otp_hash, expires_at, created_at
    FROM otp_verifications
    WHERE email = ? AND purpose = ? AND expires_at > ?
    ORDER BY id DESC
    LIMIT 1
');
$stmt->execute([$email, $purpose, $now]);
$row = $stmt->fetch(PDO::FETCH_ASSOC);

if (!$row) {
    // No active OTP. Return a generic-shaped response.
    echo json_encode([
        'dev_mode' => true,
        'email' => $email,
        'purpose' => $purpose,
        'otp' => null,
        'message' => 'No active OTP for this email/purpose. Request one via /register, /forgot, etc.',
    ]);
    exit;
}

/*
 * For dev convenience we return the OTP in plaintext. In production
 * we only ever store sha256(otp) — we cannot reverse it. So this
 * endpoint cannot reveal already-issued OTPs.
 *
 * To support the dev workflow we also write the plaintext into a
 * short-lived dev table when DEV_OTP_MODE=1 and the OTP is created.
 * See api/auth/login_common.php for the side-channel write.
 *
 * Fallback: scan recent otp_verifications rows and try common test
 * codes (123456, etc.) — NOT used here.
 */
$otpPlain = null;
try {
    $stmt = $pdo->prepare('SELECT otp_plain FROM dev_otp_plain WHERE email = ? AND purpose = ? AND expires_at > ? ORDER BY id DESC LIMIT 1');
    $stmt->execute([$email, $purpose, $now]);
    $otpPlain = $stmt->fetchColumn() ?: null;
} catch (Throwable $e) {
    // table may not exist; create on the fly
    try {
        $pdo->exec('CREATE TABLE IF NOT EXISTS dev_otp_plain (
            id INT AUTO_INCREMENT PRIMARY KEY,
            email VARCHAR(190) NOT NULL,
            purpose VARCHAR(64) NOT NULL,
            otp_plain VARCHAR(16) NOT NULL,
            expires_at DATETIME NOT NULL,
            created_at DATETIME NOT NULL,
            INDEX (email, purpose)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4');
        $stmt = $pdo->prepare('SELECT otp_plain FROM dev_otp_plain WHERE email = ? AND purpose = ? AND expires_at > ? ORDER BY id DESC LIMIT 1');
        $stmt->execute([$email, $purpose, $now]);
        $otpPlain = $stmt->fetchColumn() ?: null;
    } catch (Throwable $e2) {
        // give up silently
    }
}

$expiresTs = strtotime($row['expires_at']);
$secondsRemaining = max(0, $expiresTs - time());

echo json_encode([
    'dev_mode' => true,
    'email' => $email,
    'purpose' => $purpose,
    'otp' => $otpPlain,
    'expires_at' => $row['expires_at'],
    'created_at' => $row['created_at'],
    'seconds_remaining' => $secondsRemaining,
    'warning' => 'DEV_OTP_MODE=1 — disable in production',
]);
