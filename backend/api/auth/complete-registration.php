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

/*
 * Final step of RESIDENT self-registration.
 *
 * Creates the `users` row ONLY when the server confirms:
 *  1. a matching pending registration exists for this email,
 *  2. a `resident_register` OTP for this email was verified
 *     (verified_at stamped by verify-otp.php), has not expired,
 *     and has not already been consumed.
 *
 * The user is created as Inactive with residency_status = Pending Verification.
 * Admin must approve before the user can log in.
 */

$input = json_decode(file_get_contents('php://input'), true);
$email = trim($input['email'] ?? '');

$proofFilenames = [];
try {
    require_once __DIR__ . '/proof_validate.php';
    $proofFilenames = xevera_validate_proof_list($input);
} catch (RuntimeException $e) {
    http_response_code(400);
    echo json_encode(['error' => $e->getMessage()]);
    exit;
}

if (!$email || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
    http_response_code(400);
    echo json_encode(['error' => 'A valid email address is required.']);
    exit;
}

$purpose = 'resident_register';

try {
    // 1. Pending registration must exist for this exact email.
    $stmt = $pdo->prepare('SELECT id, name, username, email, password_hash, address, created_at FROM resident_registrations WHERE email = ? LIMIT 1');
    $stmt->execute([$email]);
    $pending = $stmt->fetch();

    if (!$pending) {
        http_response_code(400);
        echo json_encode(['error' => 'No pending registration found for this email. Please register again.']);
        exit;
    }

    // 2. A verified, unexpired, unconsumed OTP must exist for this email+purpose.
    $stmt = $pdo->prepare('SELECT id, expires_at, created_at FROM otp_verifications WHERE email = ? AND purpose = ? AND verified_at IS NOT NULL ORDER BY created_at DESC LIMIT 1');
    $stmt->execute([$email, $purpose]);
    $otpRecord = $stmt->fetch();

    if (!$otpRecord) {
        http_response_code(400);
        echo json_encode(['error' => 'Please verify the code sent to your email first.']);
        exit;
    }

    if (strtotime($otpRecord['expires_at']) < time()) {
        $stmt = $pdo->prepare('DELETE FROM otp_verifications WHERE email = ? AND purpose = ?');
        $stmt->execute([$email, $purpose]);
        http_response_code(400);
        echo json_encode(['error' => 'Verification code expired. Please request a new code.']);
        exit;
    }

    // 3. Duplicate-email guard at activation time (race safety).
    $stmt = $pdo->prepare('SELECT id FROM users WHERE email = ? LIMIT 1');
    $stmt->execute([$email]);
    if ($stmt->fetch()) {
        $stmt = $pdo->prepare('DELETE FROM resident_registrations WHERE email = ?');
        $stmt->execute([$email]);
        $stmt = $pdo->prepare('DELETE FROM otp_verifications WHERE email = ? AND purpose = ?');
        $stmt->execute([$email, $purpose]);
        http_response_code(409);
        echo json_encode(['error' => 'Email already registered.']);
        exit;
    }

    // 4. Re-reserve a unique username (a concurrent registration may have taken it).
    $username = $pending['username'];
    $base = $username;
    $suffix = 1;
    while (true) {
        $stmt = $pdo->prepare('SELECT id FROM users WHERE username = ? LIMIT 1');
        $stmt->execute([$username]);
        if (!$stmt->fetch()) break;
        $username = $base . '_' . $suffix;
        $suffix++;
    }

    // 5. Create the INACTIVE Resident account — admin must approve before login.
    // residency_proof2 holds the optional second image (column added by
    // apply_proof_documents.php; older schemas store only the first).
    $proof1 = $proofFilenames[0];
    $proof2 = $proofFilenames[1] ?? null;
    $hasProof2 = false;
    try {
        $hasProof2 = (bool)$pdo->query("SHOW COLUMNS FROM users LIKE 'residency_proof2'")->fetch();
    } catch (Throwable $e) { $hasProof2 = false; }
    if ($hasProof2) {
        $stmt = $pdo->prepare("INSERT INTO users (name, username, password_hash, email, address, role, status, email_verified, residency_proof, residency_proof2, residency_status) VALUES (?, ?, ?, ?, ?, 'Resident', 'Inactive', 1, ?, ?, 'Pending Verification')");
        $stmt->execute([$pending['name'], $username, $pending['password_hash'], $email, $pending['address'], $proof1, $proof2]);
    } else {
        $stmt = $pdo->prepare("INSERT INTO users (name, username, password_hash, email, address, role, status, email_verified, residency_proof, residency_status) VALUES (?, ?, ?, ?, ?, 'Resident', 'Inactive', 1, ?, 'Pending Verification')");
        $stmt->execute([$pending['name'], $username, $pending['password_hash'], $email, $pending['address'], $proof1]);
    }
    $userId = (int)$pdo->lastInsertId();

    // 6. Single-use: consume pending record and ALL OTPs for this email+purpose.
    $stmt = $pdo->prepare('DELETE FROM resident_registrations WHERE email = ?');
    $stmt->execute([$email]);
    $stmt = $pdo->prepare('DELETE FROM otp_verifications WHERE email = ? AND purpose = ?');
    $stmt->execute([$email, $purpose]);

    try {
        $logStmt = $pdo->prepare('INSERT INTO activity_logs (user_id, action, target_type, detail) VALUES (?, ?, ?, ?)');
        $logStmt->execute([$userId, 'register', 'auth', 'Resident registered (OTP verified, pending admin approval)']);
    } catch (Throwable $e) { /* log failure is non-fatal */ }

    echo json_encode([
        'success' => true,
        'message' => 'Email verified! Your account request is now pending administrator approval.',
        'email' => $email,
    ]);
} catch (PDOException $e) {
    error_log('xevera_complete_registration: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['error' => 'Unable to complete registration. Please try again.']);
    exit;
}
