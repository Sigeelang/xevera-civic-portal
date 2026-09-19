<?php
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
require_once __DIR__ . '/../config/mailer.php';
require_once __DIR__ . '/../config/email_templates.php';
require_once __DIR__ . '/login_common.php';

$input = json_decode(file_get_contents('php://input'), true);
$email = trim($input['email'] ?? '');
$username = trim($input['username'] ?? '');
$password = trim($input['password'] ?? '');
$scope = in_array(trim($input['scope'] ?? 'public'), ['public', 'portal'], true) ? trim($input['scope'] ?? 'public') : 'public';

if ((!$email && !$username) || !$password) {
    http_response_code(400);
    echo json_encode(['error' => 'Email/Username and password are required.']);
    exit;
}

/*
 * Brute-force throttle — PROGRESSIVE lockout.
 *
 * 1–5 failures  → no delay
 * 6–10 failures  → 10 second cooldown
 * 11–19 failures  → 60 second cooldown
 * 20+ failures  → 15 minute lockout
 *
 * Per-account AND per-IP. Checked BEFORE credential verification so a
 * correct password still gets 429 while locked. Failures are recorded in
 * the bad-credentials branch below; a successful login clears the
 * account key so legitimate users never accumulate toward the cap.
 */
$loginIdentity = strtolower($email !== '' ? $email : $username);
$loginIp = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
$loginAccountKey = 'login:' . $loginIdentity;
$loginIpKey = 'login-ip:' . $loginIp;
try {
    $throttleStmt = $pdo->prepare("SELECT COUNT(*) FROM rate_limits WHERE identifier = ? AND type = ? AND endpoint = 'auth.login' AND window_start > (NOW() - INTERVAL 900 SECOND)");
    $throttleStmt->execute([$loginAccountKey, 'account']);
    $accountFails = (int) $throttleStmt->fetchColumn();
    $throttleStmt->execute([$loginIpKey, 'ip']);
    $ipFails = (int) $throttleStmt->fetchColumn();

    $fails = max($accountFails, $ipFails);
    $retryAfter = 0;
    if ($fails >= 20) {
        $retryAfter = 900;   // 15 minutes
    } elseif ($fails >= 11) {
        $retryAfter = 60;    // 60 seconds
    } elseif ($fails >= 6) {
        $retryAfter = 10;    // 10 seconds
    }

    // Compute actual remaining lockout time from the oldest qualifying
    // failure so the client sees an accurate countdown (not the full
    // tier duration which may be over-punitive).
    if ($retryAfter > 0) {
        $oldestStmt = $pdo->prepare("SELECT MIN(window_start) FROM rate_limits WHERE identifier IN (?, ?) AND type IN ('account', 'ip') AND endpoint = 'auth.login' AND window_start > (NOW() - INTERVAL 900 SECOND)");
        $oldestStmt->execute([$loginAccountKey, $loginIpKey]);
        $oldest = $oldestStmt->fetchColumn();
        if ($oldest) {
            $expiresAt = strtotime($oldest) + 900;
            $actualRemaining = max(1, $expiresAt - time());
            $retryAfter = min($retryAfter, $actualRemaining);
        }

        http_response_code(429);
        header('Retry-After: ' . $retryAfter);
        echo json_encode([
            'error'      => 'Too many failed attempts. Please try again later.',
            'retry_after' => $retryAfter,
            'locked_until' => date('c', time() + $retryAfter),
        ]);
        exit;
    }

    // Prune stale throttle rows so the table stays small even under
    // sustained guessing traffic.
    $pdo->exec("DELETE FROM rate_limits WHERE endpoint = 'auth.login' AND window_start < (NOW() - INTERVAL 900 SECOND)");
} catch (PDOException $e) {
    // Fail open on throttle-infrastructure errors: authentication itself
    // must keep working; the failure is still logged below on bad creds.
    error_log('xevera_login: throttle check failed: ' . $e->getMessage());
}

if ($email) {
    $stmt = $pdo->prepare('SELECT id, name, username, email, password_hash, role, status, profile_photo, address, must_change_password FROM users WHERE email = ? OR username = ?');
    $stmt->execute([$email, $email]);
} else {
    $stmt = $pdo->prepare('SELECT id, name, username, email, password_hash, role, status, profile_photo, address, must_change_password FROM users WHERE username = ?');
    $stmt->execute([$username]);
}
$user = $stmt->fetch();

if (!$user || !password_verify($password, $user['password_hash'])) {
    // Security event: record failed login attempts in activity_logs, and
    // count the failure toward the brute-force throttle (account + IP keys).
    try {
        $attempted = $email !== '' ? $email : $username;
        $ip = $_SERVER['REMOTE_ADDR'] ?? '';
        $stmt = $pdo->prepare('INSERT INTO activity_logs (user_id, action, target_type, target_id, detail, ip_address) VALUES (NULL, ?, ?, NULL, ?, ?)');
        $stmt->execute(['login_failed', 'auth', 'Failed login attempt for: ' . $attempted, $ip]);
        $rateStmt = $pdo->prepare('INSERT INTO rate_limits (identifier, type, endpoint, window_start) VALUES (?, ?, ?, NOW())');
        $rateStmt->execute([$loginAccountKey, 'account', 'auth.login']);
        $rateStmt->execute([$loginIpKey, 'ip', 'auth.login']);
    } catch (PDOException $e) { /* logging must never block auth responses */ }

    http_response_code(401);
    echo json_encode(['error' => 'Invalid email or password.']);
    exit;
}

// Forgive past failures on a good login so legitimate users (typos, shared
// machines) never accumulate toward the throttle cap. Clear both account
// and IP keys so shared-IP users are not penalised for others' failures.
try {
    $clearStmt = $pdo->prepare("DELETE FROM rate_limits WHERE endpoint = 'auth.login' AND (identifier = ? OR identifier = ?)");
    $clearStmt->execute([$loginAccountKey, $loginIpKey]);
} catch (PDOException $e) { /* throttle hygiene must never block login */ }

if ($user['status'] !== 'Active') {
    http_response_code(403);
    echo json_encode(['error' => 'Account is inactive. Contact an administrator.']);
    exit;
}

/*
 * Maintenance mode: residents cannot sign in while maintenance is ON
 * (existing resident sessions are also signed out automatically).
 * Staff/Admin/Super Admin keep access.
 */
if (($user['role'] ?? '') === 'Resident') {
    try {
        $mStmt = $pdo->prepare('SELECT `value` FROM system_settings WHERE `key` = ? LIMIT 1');
        $mStmt->execute(['maintenance_mode']);
        $mRow = $mStmt->fetch();
        if ($mRow && ($mRow['value'] === '1' || $mRow['value'] === 'true')) {
            http_response_code(403);
            echo json_encode(['error' => 'The system is under maintenance. Please try again later.']);
            exit;
        }
    } catch (PDOException $e) {
        http_response_code(403);
        echo json_encode(['error' => 'The system is under maintenance. Please try again later.']);
        exit;
    }
}

/*
 * ============================ 2FA GATE ============================
 * The full session token is NEVER issued here when 2FA is required.
 * We only issue a short-lived single-purpose "2fa_pending" token that
 * requireAuth() rejects, then email an OTP. The real session is
 * created by verify-login-otp.php after the OTP is verified.
 */
[$twofaEnabled, $twofaRoles] = xevera_twofa_policy($pdo);
$needs2fa = $twofaEnabled && in_array($user['role'], $twofaRoles, true);

if ($needs2fa) {
    if (xevera_otp_throttled($pdo, $user['email'], 'login_2fa')) {
        http_response_code(429);
        echo json_encode(['error' => 'Too many verification codes requested. Please wait a few minutes and try again.']);
        exit;
    }

    $otp = random_int(100000, 999999);
    $otpHash = hash('sha256', $otp);
    $otpStr = (string) $otp;
    $expires = date('Y-m-d H:i:s', time() + 300); // 5 minutes

    $stmt = $pdo->prepare('DELETE FROM otp_verifications WHERE email = ? AND purpose = ?');
    $stmt->execute([$user['email'], 'login_2fa']);

    $stmt = $pdo->prepare('INSERT INTO otp_verifications (email, otp_hash, purpose, expires_at, created_at) VALUES (?, ?, ?, ?, NOW())');
    $stmt->execute([$user['email'], $otpHash, 'login_2fa', $expires]);

    $subject = xevera_otp_subject('login_2fa');
    $recipientName = trim((string)($user['name'] ?? ''));
    $plainBody = xevera_otp_email_text($otpStr, 'login_2fa', $recipientName);
    $htmlBody = xevera_otp_email_html($otpStr, 'login_2fa', $recipientName);

    $sent = xevera_mail($user['email'], $subject, $plainBody, $htmlBody);

    if (!$sent) {
        // Fail closed: remove the unusable code, never leak it.
        $stmt = $pdo->prepare('DELETE FROM otp_verifications WHERE email = ? AND purpose = ?');
        $stmt->execute([$user['email'], 'login_2fa']);

        http_response_code(500);
        echo json_encode(['error' => 'Unable to send verification code.']);
        exit;
    }

    try {
        $ip = $_SERVER['REMOTE_ADDR'] ?? '';
        $stmt = $pdo->prepare('INSERT INTO activity_logs (user_id, action, target_type, target_id, detail, ip_address) VALUES (?, ?, ?, NULL, ?, ?)');
        $stmt->execute([$user['id'], '2fa_otp_sent', 'auth', '2FA verification code sent', $ip]);
    } catch (PDOException $e) { /* logging is best-effort */ }

    // Short-lived, single-purpose token. NOT accepted as a session.
    $pendingToken = issue_token([
        'user_id' => (int) $user['id'],
        'email' => $user['email'],
        'role' => $user['role'],
        'scope' => '2fa_pending',
        'login_scope' => $scope,
        'exp' => time() + 300,
    ]);

    echo json_encode([
        'otp_required' => true,
        'pending_token' => $pendingToken,
        'role' => $user['role'],
        'email' => $user['email'],
        'message' => 'A verification code has been sent to your email.',
    ]);
    exit;
}

/* ==================== No 2FA required: full session ==================== */
echo json_encode(xevera_issue_session($pdo, $user, $scope));
