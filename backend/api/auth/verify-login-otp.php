<?php
/**
 * Login 2FA - second step.
 *
 * Verifies the emailed OTP together with the short-lived "2fa_pending"
 * token issued by login.php. Only AFTER successful verification is the
 * full authenticated session created. The pending token is rejected by
 * requireAuth() and cannot be used to call any other API.
 */
header('Content-Type: application/json');

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
require_once __DIR__ . '/../middleware/token.php';
require_once __DIR__ . '/login_common.php';
require_once __DIR__ . '/../middleware/write_ratelimit.php';
xevera_write_rate_limit($pdo, 'auth.verify_otp');

$input = json_decode(file_get_contents('php://input'), true);
$pendingToken = trim($input['pending_token'] ?? '');
$otp = trim($input['otp'] ?? '');

if (!$pendingToken || !$otp || strlen($otp) !== 6) {
    http_response_code(400);
    echo json_encode(['error' => 'Please enter a valid 6-digit verification code.']);
    exit;
}

/*
 * Validate the pending token: signature, expiry, and scope.
 */
$payload = null;
{
    $dot = strrpos($pendingToken, '.');
    $b64 = $dot === false ? null : substr($pendingToken, 0, $dot);
    $sig = $dot === false ? null : substr($pendingToken, $dot + 1);
    if ($b64 !== null) {
        $expected = hash_hmac('sha256', $b64, xevera_secret());
        $json = hash_equals($expected, $sig) ? xevera_decode_b64($b64) : null;
        $data = $json === null ? null : json_decode($json, true);
        if (is_array($data) && isset($data['exp']) && $data['exp'] >= time()) {
            $payload = $data;
        }
    }
}

if (!$payload || ($payload['scope'] ?? '') !== '2fa_pending') {
    http_response_code(401);
    echo json_encode(['error' => 'Verification session expired. Please sign in again.']);
    exit;
}

$email = (string) ($payload['email'] ?? '');
$userId = (int) ($payload['user_id'] ?? 0);
$loginScope = in_array($payload['login_scope'] ?? 'public', ['public', 'portal'], true)
    ? $payload['login_scope']
    : 'public';

$stmt = $pdo->prepare('SELECT id, name, username, email, password_hash, role, status, profile_photo, address, must_change_password FROM users WHERE id = ?');
$stmt->execute([$userId]);
$user = $stmt->fetch();

if (!$user || $user['status'] !== 'Active' || $user['email'] !== $email) {
    http_response_code(401);
    echo json_encode(['error' => 'Verification session expired. Please sign in again.']);
    exit;
}

$stmt = $pdo->prepare('SELECT id, otp_hash, expires_at, attempts FROM otp_verifications WHERE email = ? AND purpose = ? ORDER BY created_at DESC LIMIT 1');
$stmt->execute([$email, 'login_2fa']);
$otpRecord = $stmt->fetch();

if (!$otpRecord) {
    http_response_code(400);
    echo json_encode(['error' => 'Verification code expired or invalid. Please sign in again.']);
    exit;
}

$verified = hash_equals((string) $otpRecord['otp_hash'], hash('sha256', $otp));
$expired = strtotime($otpRecord['expires_at']) < time();
$attempts = (int) $otpRecord['attempts'] + 1;

if ($verified && !$expired) {
    $stmt = $pdo->prepare('DELETE FROM otp_verifications WHERE id = ?');
    $stmt->execute([$otpRecord['id']]);

    try {
        $ip = $_SERVER['REMOTE_ADDR'] ?? '';
        $stmt = $pdo->prepare('INSERT INTO activity_logs (user_id, action, target_type, target_id, detail, ip_address) VALUES (?, ?, ?, NULL, ?, ?)');
        $stmt->execute([$user['id'], '2fa_verified', 'auth', 'Login 2FA verified', $ip]);
    } catch (PDOException $e) { /* logging is best-effort */ }

    // Full authenticated session - only now.
    echo json_encode(xevera_issue_session($pdo, $user, $loginScope));
    exit;
}

if ($expired) {
    $stmt = $pdo->prepare('DELETE FROM otp_verifications WHERE id = ?');
    $stmt->execute([$otpRecord['id']]);
    http_response_code(400);
    echo json_encode(['error' => 'This verification code has expired. Please sign in again.']);
    exit;
}

if ($attempts >= 5) {
    $stmt = $pdo->prepare('DELETE FROM otp_verifications WHERE id = ?');
    $stmt->execute([$otpRecord['id']]);
    http_response_code(400);
    echo json_encode(['error' => 'Too many verification attempts. Please sign in again.']);
    exit;
}

$stmt = $pdo->prepare('UPDATE otp_verifications SET attempts = ? WHERE id = ?');
$stmt->execute([$attempts, $otpRecord['id']]);
http_response_code(400);
echo json_encode(['error' => 'Invalid verification code. Please check your email and try again.']);
