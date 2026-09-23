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
xevera_write_rate_limit($pdo, 'auth.verify_otp');

$input = json_decode(file_get_contents('php://input'), true);
$email = trim($input['email'] ?? '');
$otp = trim($input['otp'] ?? '');

if (!$email || !$otp || strlen($otp) !== 6) {
    http_response_code(400);
    echo json_encode(['error' => 'Please enter a valid 6-digit OTP code.']);
    exit;
}

// Find the OTP record for this email and purpose
$stmt = $pdo->prepare('SELECT id, otp_hash, purpose, expires_at, attempts FROM otp_verifications WHERE email = ? AND purpose = ? ORDER BY created_at DESC LIMIT 1');
$stmt->execute([$email, $input['purpose'] ?? 'resident_password_reset']);
$otp_record = $stmt->fetch();

if (!$otp_record) {
    http_response_code(400);
    echo json_encode(['error' => 'OTP code expired or invalid. Please request a new one.']);
    exit;
}

/*
 * Purposes are strictly separated - a code issued for one action can
 * never verify another. password_change / email_change are handled by
 * the generic success branch below; the follow-up endpoint then checks
 * for verified_at before applying anything.
 */
$allowed_purposes = ['resident_register', 'resident_password_reset', 'password_change', 'password_change_first_login', 'email_change'];
if (!in_array($otp_record['purpose'], $allowed_purposes, true)) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid verification purpose.']);
    exit;
}

// Verify OTP hash (constant-time comparison)
$otp_verified = hash_equals((string) $otp_record['otp_hash'], hash('sha256', $otp));

// Check expiry
$expired = strtotime($otp_record['expires_at']) < time();

// Check attempts
$attempts = $otp_record['attempts'] + 1;

if ($otp_verified && !$expired) {
    // OTP verified - mark as verified and clear attempts
    $stmt = $pdo->prepare('UPDATE otp_verifications SET verified_at = NOW(), attempts = 0 WHERE id = ?');
    $stmt->execute([$otp_record['id']]);

    // Return success based on purpose
    $purpose = $otp_record['purpose'];

    if ($purpose === 'resident_register') {
        // For registration: mark the resident's email as verified.
        try {
            $stmt = $pdo->prepare('UPDATE users SET email_verified = 1 WHERE email = ?');
            $stmt->execute([$email]);
        } catch (PDOException $e) { /* column may not exist on older schemas */ }

        echo json_encode([
            'success' => true,
            'message' => 'OTP verified successfully! Your resident account is now verified.',
            'purpose' => $purpose,
        ]);
    } elseif ($purpose === 'resident_password_reset') {
        // For password reset: allow user to set new password
        echo json_encode([
            'success' => true,
            'message' => 'OTP verified successfully! You can now set a new password.',
            'purpose' => $purpose,
            'requires_new_password' => true,
        ]);
    } else {
        echo json_encode([
            'success' => true,
            'message' => 'OTP verified successfully!',
            'purpose' => $purpose,
        ]);
    }
} elseif ($expired) {
    // Delete expired OTP
    $stmt = $pdo->prepare('DELETE FROM otp_verifications WHERE id = ?');
    $stmt->execute([$otp_record['id']]);
    http_response_code(400);
    echo json_encode(['error' => 'This verification code has expired. Please request a new code.']);
} elseif ($attempts >= 5) {
    // Delete OTP after max attempts
    $stmt = $pdo->prepare('DELETE FROM otp_verifications WHERE id = ?');
    $stmt->execute([$otp_record['id']]);
    http_response_code(400);
    echo json_encode(['error' => 'Too many verification attempts. Please request a new OTP code.']);
} else {
    // Update attempts count
    $stmt = $pdo->prepare('UPDATE otp_verifications SET attempts = ? WHERE id = ?');
    $stmt->execute([$attempts, $otp_record['id']]);
    http_response_code(400);
    echo json_encode(['error' => 'Invalid verification code. Please check your Gmail and try again.']);
}