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
 * OTP-FREE REGISTRATION (policy change).
 *
 * The account is created immediately as an Active Resident - no OTP is
 * generated, emailed, or verified. The pending record is consumed right
 * away. Staff/Admin/Super Admin flows are untouched.
 * (see api/users/create.php).
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

// Throttle registrations (same policy as the old OTP flow).
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
 * Create the ACTIVE Resident account immediately - no OTP step.
 * Mirrors complete-registration.php steps 3-6, minus OTP verification.
 */
$purpose = 'resident_register';

try {
    // Duplicate-email guard at activation time (race safety).
    $stmt = $pdo->prepare('SELECT id FROM users WHERE email = ? LIMIT 1');
    $stmt->execute([$email]);
    if ($stmt->fetch()) {
        $stmt = $pdo->prepare('DELETE FROM resident_registrations WHERE email = ?');
        $stmt->execute([$email]);
        http_response_code(409);
        echo json_encode(['error' => 'Email already registered.']);
        exit;
    }

    // Re-reserve a unique username (a concurrent registration may have taken it).
    $stmt = $pdo->prepare('SELECT id FROM users WHERE username = ? LIMIT 1');
    $stmt->execute([$username]);
    if ($stmt->fetch()) {
        $base = $username;
        $suffix = 1;
        while (true) {
            $candidate = $base . '_' . $suffix;
            $stmt = $pdo->prepare('SELECT id FROM users WHERE username = ? LIMIT 1');
            $stmt->execute([$candidate]);
            if (!$stmt->fetch()) { $username = $candidate; break; }
            $suffix++;
        }
    }

    // Create the ACTIVE Resident account. email_verified stays 0 because
    // no email ownership check runs in the OTP-free flow.
    $stmt = $pdo->prepare("INSERT INTO users (name, username, password_hash, email, address, role, status, email_verified) VALUES (?, ?, ?, ?, ?, 'Resident', 'Active', 0)");
    $stmt->execute([$name, $username, $hash, $email, $address ?: null]);
    $userId = (int)$pdo->lastInsertId();

    // Consume the pending record and any stale OTPs for this email+purpose.
    $stmt = $pdo->prepare('DELETE FROM resident_registrations WHERE email = ?');
    $stmt->execute([$email]);
    $stmt = $pdo->prepare('DELETE FROM otp_verifications WHERE email = ? AND purpose = ?');
    $stmt->execute([$email, $purpose]);

    try {
        $logStmt = $pdo->prepare('INSERT INTO activity_logs (user_id, action, target_type, detail) VALUES (?, ?, ?, ?)');
        $logStmt->execute([$userId, 'register', 'auth', 'Resident registered (OTP-free)']);
    } catch (Throwable $e) { /* log failure is non-fatal */ }

    echo json_encode([
        'success' => true,
        'pending' => false,
        'account_created' => true,
        'message' => 'Your resident account has been created. You can now log in.',
        'email' => $email,
    ]);
} catch (PDOException $e) {
    error_log('xevera_register: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['error' => 'Unable to create account. Please try again.']);
    exit;
}
