<?php
header('Content-Type: application/json');
require_once __DIR__ . '/../config/cors.php';

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }
if ($_SERVER['REQUEST_METHOD'] !== 'POST') { http_response_code(405); echo json_encode(['error' => 'Method not allowed']); exit; }

/*
 * Step 2 of the OTP-protected email change.
 *
 * Runs only AFTER the `email_change` OTP sent to the NEW address has
 * been verified through the existing verify-otp.php endpoint. The
 * account email is updated here and marked verified; the old address
 * remains untouched until this point succeeds.
 */

require_once __DIR__ . '/../middleware/auth.php';
$user = requireAuth();

require_once __DIR__ . '/../config/database.php';

$uid = (int)$user['user_id'];
$input = json_decode(file_get_contents('php://input'), true) ?: [];
$newEmail = strtolower(trim((string)($input['new_email'] ?? '')));

if (!$newEmail || !filter_var($newEmail, FILTER_VALIDATE_EMAIL)) {
    http_response_code(400);
    echo json_encode(['error' => 'A valid new email address is required.']);
    exit;
}

$stmt = $pdo->prepare('SELECT email FROM users WHERE id = ?');
$stmt->execute([$uid]);
$row = $stmt->fetch();

if (!$row) {
    http_response_code(404);
    echo json_encode(['error' => 'Account not found.']);
    exit;
}

$purpose = 'email_change';

// Require a verified, non-expired `email_change` OTP for exactly this
// new address. An OTP issued for another purpose or another address
// will never satisfy this check.
$stmt = $pdo->prepare('SELECT id, expires_at FROM otp_verifications WHERE email = ? AND purpose = ? AND verified_at IS NOT NULL ORDER BY created_at DESC LIMIT 1');
$stmt->execute([$newEmail, $purpose]);
$otp_record = $stmt->fetch();

if (!$otp_record) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid OTP. Please verify the code sent to your new email first.']);
    exit;
}

if (strtotime($otp_record['expires_at']) < time()) {
    http_response_code(400);
    echo json_encode(['error' => 'OTP expired. Please request a new verification code.']);
    exit;
}

// Re-check availability in case it was taken while the code was pending.
$stmt = $pdo->prepare('SELECT id FROM users WHERE email = ? AND id != ?');
$stmt->execute([$newEmail, $uid]);
if ($stmt->fetch()) {
    http_response_code(409);
    echo json_encode(['error' => 'That email address is already registered.']);
    exit;
}

try {
    $stmt = $pdo->prepare('UPDATE users SET email = ?, email_verified = 1 WHERE id = ?');
    $stmt->execute([$newEmail, $uid]);
} catch (PDOException $e) {
    // Older schema without email_verified - update the address only.
    $stmt = $pdo->prepare('UPDATE users SET email = ? WHERE id = ?');
    $stmt->execute([$newEmail, $uid]);
}

// Invalidate this and any previous email-change OTPs.
$stmt = $pdo->prepare('DELETE FROM otp_verifications WHERE email = ? AND purpose = ?');
$stmt->execute([$newEmail, $purpose]);

$logStmt = $pdo->prepare('INSERT INTO activity_logs (user_id, action, target_type, target_id, detail) VALUES (?, ?, ?, NULL, ?)');
$logStmt->execute([$uid, 'change_email', 'user', 'Changed account email via Gmail OTP verification']);

echo json_encode([
    'success' => true,
    'message' => 'Your Gmail address has been changed and verified successfully.',
    'email' => $newEmail,
]);
