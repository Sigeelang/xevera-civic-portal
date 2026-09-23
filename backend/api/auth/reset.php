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
xevera_write_rate_limit($pdo, 'auth.password_reset');

$input = json_decode(file_get_contents('php://input'), true);
$email = trim($input['email'] ?? '');
$newPassword = trim($input['new_password'] ?? '');
$confirmPassword = trim($input['confirm_password'] ?? '');

if (!$email || !$newPassword || !$confirmPassword) {
    http_response_code(400);
    echo json_encode(['error' => 'All fields are required.']);
    exit;
}

if ($newPassword !== $confirmPassword) {
    http_response_code(400);
    echo json_encode(['error' => 'New password and confirmation do not match.']);
    exit;
}

if (strlen($newPassword) < 8 || !preg_match('/[A-Z]/', $newPassword) || !preg_match('/[a-z]/', $newPassword)
    || !preg_match('/[0-9]/', $newPassword) || !preg_match('/[^A-Za-z0-9]/', $newPassword)) {
    http_response_code(400);
    echo json_encode(['error' => 'Password must be at least 8 characters and include uppercase, lowercase, a number, and a special character.']);
    exit;
}

// Find the verified OTP record (verified_at set server-side by verify-otp.php after cryptographic check)
$stmt = $pdo->prepare('SELECT id, purpose, expires_at FROM otp_verifications WHERE email = ? AND verified_at IS NOT NULL AND purpose = ? ORDER BY created_at DESC LIMIT 1');
$stmt->execute([$email, $input['purpose'] ?? 'resident_password_reset']);
$otp_record = $stmt->fetch();

if (!$otp_record) {
    http_response_code(400);
    echo json_encode(['error' => 'No verified OTP found for this email and purpose. Please request a new one.']);
    exit;
}

// Defense-in-depth: reject even if verified_at was set, if the OTP itself has expired
if (strtotime($otp_record['expires_at']) < time()) {
    $stmt = $pdo->prepare('DELETE FROM otp_verifications WHERE id = ?');
    $stmt->execute([$otp_record['id']]);
    http_response_code(400);
    echo json_encode(['error' => 'Verification has expired. Please request a new code.']);
    exit;
}

$purpose = $otp_record['purpose'];

// Update user password
$hash = password_hash($newPassword, PASSWORD_DEFAULT);

if ($purpose === 'resident_password_reset') {
    // Standard password reset
    $stmt = $pdo->prepare('UPDATE users SET password_hash = ?, must_change_password = 0 WHERE email = ?');
    $stmt->execute([$hash, $email]);
} elseif ($purpose === 'resident_register') {
    // For registration: set the password for the newly registered user
    // Assuming the user was already created during registration flow
    $stmt = $pdo->prepare('UPDATE users SET password_hash = ?, must_change_password = 0 WHERE email = ?');
    $stmt->execute([$hash, $email]);
} else {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid OTP purpose.']);
    exit;
}

if ($stmt->rowCount() === 0) {
    http_response_code(404);
    echo json_encode(['error' => 'Account not found for this email.']);
    exit;
}

// Clear the OTP record after successful password reset
$stmt = $pdo->prepare('DELETE FROM otp_verifications WHERE email = ? AND purpose = ?');
$stmt->execute([$email, $purpose]);

// Log the activity
$logStmt = $pdo->prepare('INSERT INTO activity_logs (user_id, action, target_type, target_id, detail) VALUES (?, ?, ?, NULL, ?)');
$userStmt = $pdo->prepare('SELECT id FROM users WHERE email = ?');
$userStmt->execute([$email]);
$userRow = $userStmt->fetch();
$logStmt->execute([$userRow ? (int)$userRow['id'] : null, 'reset_password', 'auth', "Password reset via OTP verification ($purpose)"]);

echo json_encode([
    'success' => true,
    'message' => 'Your password has been reset successfully! You can now log in with your new password.',
]);