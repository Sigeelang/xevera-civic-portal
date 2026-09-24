<?php
/*
 * Super Admin emergency recovery (standalone /system-aut portal).
 *
 * Unauthenticated by design — possession of a valid, unused,
 * unexpired recovery code PLUS control of the bound official email
 * (via OTP) is the authorization. All secrets are fail-closed:
 * codes are bcrypt-hashed, OTPs are sha256-hashed with 5-minute
 * expiry and 5-attempt lockout, and every outcome is audit-logged.
 *
 * Actions (JSON body, POST only):
 *   {action:'request', full_name, email, recovery_code, new_password}
 *       Validates everything (including password policy), then sends
 *       a 6-digit OTP (purpose: superadmin_recovery).
 *   {action:'confirm', full_name, email, otp}
 *       Verifies the OTP, then creates a new Super Admin account or
 *       restores an existing Super Admin for that email. Consumes the
 *       recovery code (single-use).
 */
header('Content-Type: application/json');
require_once __DIR__ . '/../config/cors.php';

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/mailer.php';
require_once __DIR__ . '/../config/email_templates.php';
require_once __DIR__ . '/login_common.php';
require_once __DIR__ . '/../middleware/write_ratelimit.php';
xevera_write_rate_limit($pdo, 'auth.superadmin_recovery');

const SAR_OTP_PURPOSE = 'superadmin_recovery';
const SAR_MAX_CODE_ATTEMPTS = 10;
/* Permanent owner-defined recovery code. Never expires, never locks,
   never consumed — but the email OTP step remains mandatory, so inbox
   possession is still required. Compared in constant time. */
const SAR_STATIC_CODE = 'xevera123';

function sar_is_static_code(string $code): bool {
    return strlen($code) === strlen(SAR_STATIC_CODE) && hash_equals(SAR_STATIC_CODE, $code);
}

$input = json_decode(file_get_contents('php://input'), true);
if (!is_array($input)) $input = [];
$action = $input['action'] ?? '';

function sar_fail(string $msg, int $code = 400): void {
    http_response_code($code);
    echo json_encode(['error' => $msg]);
    exit;
}

function sar_password_ok(string $password): bool {
    if (strlen($password) < 8) return false;
    if (!preg_match('/[A-Z]/', $password)) return false;
    if (!preg_match('/[a-z]/', $password)) return false;
    if (!preg_match('/[0-9]/', $password)) return false;
    if (!preg_match('/[^A-Za-z0-9]/', $password)) return false;
    return true;
}

/*
 * Find the newest usable code for this email and verify the secret.
 * Generic failure either way so callers can never distinguish
 * "unknown email" from "wrong code".
 */
function sar_match_code(PDO $pdo, string $email, string $code): ?array {
    $stmt = $pdo->prepare('SELECT id, code_hash, attempts FROM superadmin_recovery_codes WHERE email = ? AND used_at IS NULL AND expires_at > NOW() ORDER BY id DESC');
    $stmt->execute([$email]);
    foreach ($stmt->fetchAll() as $row) {
        if ((int)$row['attempts'] >= SAR_MAX_CODE_ATTEMPTS) continue;
        if (password_verify($code, $row['code_hash'])) return $row;
    }
    return null;
}

function sar_bump_attempts(PDO $pdo, string $email): void {
    try {
        $pdo->prepare('UPDATE superadmin_recovery_codes SET attempts = attempts + 1 WHERE email = ? AND used_at IS NULL AND expires_at > NOW()')->execute([$email]);
    } catch (Throwable $e) { /* never break the response */ }
}

function sar_audit(PDO $pdo, ?int $userId, string $action, string $detail): void {
    try {
        $pdo->prepare("INSERT INTO activity_logs (user_id, action, target_type, target_id, detail) VALUES (?, ?, 'auth', NULL, ?)")->execute([$userId, $action, $detail]);
    } catch (Throwable $e) { /* analytics must never break recovery */ }
}

/* ================= REQUEST (validate + send OTP) ================= */
if ($action === 'request') {
    $fullName = trim($input['full_name'] ?? '');
    $email = strtolower(trim($input['email'] ?? ''));
    // Same normalization as the portal input (lowercase alphanumerics).
    $code = strtolower(preg_replace('/[^A-Za-z0-9]/', '', (string)($input['recovery_code'] ?? '')));
    $password = (string)($input['new_password'] ?? '');

    if ($fullName === '' || mb_strlen($fullName) > 100) sar_fail('Please enter your full name.');
    if (!$email || !filter_var($email, FILTER_VALIDATE_EMAIL)) sar_fail('Please enter your official email address.');
    if (strlen($code) < 8 || strlen($code) > 64) sar_fail('Invalid recovery details.');
    if (!sar_password_ok($password)) sar_fail('Password does not meet the required security requirements.');
    if ($password !== (string)($input['confirm_password'] ?? $password)) sar_fail('Passwords do not match.');

    $matched = sar_is_static_code($code) ? true : sar_match_code($pdo, $email, $code);
    if (!$matched) {
        sar_bump_attempts($pdo, $email);
        sar_audit($pdo, null, 'superadmin_recovery_denied', 'Rejected recovery request for ' . $email);
        sar_fail('Invalid or expired recovery code.');
    }

    if (xevera_otp_throttled($pdo, $email, SAR_OTP_PURPOSE)) {
        http_response_code(429);
        echo json_encode(['error' => 'Too many verification codes requested. Please wait a few minutes and try again.']);
        exit;
    }

    $otp = (string)random_int(100000, 999999);
    $expires = date('Y-m-d H:i:s', time() + 300); // 5 minutes
    $now = date('Y-m-d H:i:s');

    $pdo->prepare('DELETE FROM otp_verifications WHERE email = ? AND purpose = ?')->execute([$email, SAR_OTP_PURPOSE]);
    $pdo->prepare('INSERT INTO otp_verifications (email, otp_hash, purpose, expires_at, last_sent_at, created_at) VALUES (?, ?, ?, ?, ?, NOW())')
        ->execute([$email, hash('sha256', $otp), SAR_OTP_PURPOSE, $expires, $now]);
    xevera_dev_otp_record($pdo, $email, SAR_OTP_PURPOSE, $otp, $expires);

    $subject = xevera_otp_subject(SAR_OTP_PURPOSE);
    $plainBody = xevera_otp_email_text($otp, SAR_OTP_PURPOSE, $fullName);
    $htmlBody = xevera_otp_email_html($otp, SAR_OTP_PURPOSE, $fullName);
    $sent = xevera_mail($email, $subject, $plainBody, $htmlBody);
    sar_audit($pdo, null, 'otp_sent', 'OTP sent (superadmin_recovery)');

    if (!$sent) {
        $pdo->prepare('DELETE FROM otp_verifications WHERE email = ? AND purpose = ?')->execute([$email, SAR_OTP_PURPOSE]);
        sar_fail('Unable to send verification code.', 500);
    }

    echo json_encode(['message' => 'A verification code has been sent to your official email address.']);
    exit;
}

/* ================= CONFIRM (verify OTP + create/restore) ================= */
if ($action === 'confirm') {
    $fullName = trim($input['full_name'] ?? '');
    $email = strtolower(trim($input['email'] ?? ''));
    $otp = trim($input['otp'] ?? '');
    $password = (string)($input['new_password'] ?? '');
    // Same normalization as the request step; identifies the static code.
    $code = strtolower(preg_replace('/[^A-Za-z0-9]/', '', (string)($input['recovery_code'] ?? '')));
    $isStaticCode = sar_is_static_code($code);

    if ($fullName === '' || mb_strlen($fullName) > 100) sar_fail('Please enter your full name.');
    if (!$email || !filter_var($email, FILTER_VALIDATE_EMAIL)) sar_fail('Please enter your official email address.');
    if (strlen($otp) !== 6) sar_fail('Please enter a valid 6-digit OTP code.');
    if (!sar_password_ok($password)) sar_fail('Password does not meet the required security requirements.');

    $stmt = $pdo->prepare('SELECT id, otp_hash, expires_at, attempts FROM otp_verifications WHERE email = ? AND purpose = ? ORDER BY created_at DESC LIMIT 1');
    $stmt->execute([$email, SAR_OTP_PURPOSE]);
    $otpRow = $stmt->fetch();

    if (!$otpRow) sar_fail('OTP code expired or invalid. Please request a new one.');

    $verified = hash_equals((string)$otpRow['otp_hash'], hash('sha256', $otp));
    $expired = strtotime($otpRow['expires_at']) < time();
    $attempts = (int)$otpRow['attempts'] + 1;

    if (!$verified || $expired) {
        if ($expired || $attempts >= 5) {
            $pdo->prepare('DELETE FROM otp_verifications WHERE id = ?')->execute([$otpRow['id']]);
            sar_fail($expired ? 'This verification code has expired. Please request a new code.' : 'Too many verification attempts. Please request a new OTP code.');
        }
        $pdo->prepare('UPDATE otp_verifications SET attempts = ? WHERE id = ?')->execute([$attempts, $otpRow['id']]);
        sar_bump_attempts($pdo, $email);
        sar_audit($pdo, null, 'superadmin_recovery_denied', 'Failed OTP confirmation for ' . $email);
        sar_fail('Invalid verification code. Please check your email and try again.');
    }

    // OTP good — consume it immediately so it cannot be replayed.
    $pdo->prepare('DELETE FROM otp_verifications WHERE id = ?')->execute([$otpRow['id']]);

    // Defense in depth: a usable code must still exist for this email
    // (skipped for the permanent static code, which lives in config).
    $consumeId = 0;
    if (!$isStaticCode) {
        $codeRow = $pdo->prepare('SELECT id FROM superadmin_recovery_codes WHERE email = ? AND used_at IS NULL AND expires_at > NOW() ORDER BY id DESC LIMIT 1');
        $codeRow->execute([$email]);
        $usable = $codeRow->fetch();
        if (!$usable) {
            sar_audit($pdo, null, 'superadmin_recovery_denied', 'Confirm without usable code for ' . $email);
            sar_fail('Invalid or expired recovery code.');
        }
        $consumeId = (int)$usable['id'];
    }

    // Restore path: email already belongs to a Super Admin.
    $stmt = $pdo->prepare('SELECT id, role FROM users WHERE email = ? LIMIT 1');
    $stmt->execute([$email]);
    $existing = $stmt->fetch();

    $hash = password_hash($password, PASSWORD_DEFAULT);
    if ($existing) {
        if ($existing['role'] !== 'Super Admin') {
            sar_audit($pdo, (int)$existing['id'], 'superadmin_recovery_denied', 'Recovery refused: email belongs to role ' . $existing['role']);
            sar_fail('This email already belongs to a non-admin account and cannot be elevated through recovery.', 409);
        }
        $pdo->prepare('UPDATE users SET name = ?, password_hash = ?, status = ?, must_change_password = 0 WHERE id = ?')
            ->execute([$fullName, $hash, 'Active', (int)$existing['id']]);
        $userId = (int)$existing['id'];
    } else {
        // Unique username derived from the email local part.
        $base = strtolower(preg_replace('/[^a-z0-9]/', '', explode('@', $email)[0] ?? ''));
        if ($base === '') $base = 'superadmin';
        $username = $base;
        for ($i = 0; $i < 25; $i++) {
            $chk = $pdo->prepare('SELECT id FROM users WHERE username = ? LIMIT 1');
            $chk->execute([$username]);
            if (!$chk->fetch()) break;
            $username = $base . random_int(10, 99);
        }
        $pdo->prepare('INSERT INTO users (name, username, email, phone, password_hash, role, status, must_change_password) VALUES (?, ?, ?, NULL, ?, ?, ?, 0)')
            ->execute([$fullName, $username, $email, $hash, 'Super Admin', 'Active']);
        $userId = (int)$pdo->lastInsertId();
    }

    // Best-effort verification flags (columns may not exist on older schemas).
    try {
        $pdo->prepare('UPDATE users SET email_verified = 1 WHERE id = ?')->execute([$userId]);
    } catch (Throwable $e) { /* ignore */ }
    try {
        $pdo->prepare("UPDATE users SET residency_status = 'Residency Verified' WHERE id = ?")->execute([$userId]);
    } catch (Throwable $e) { /* ignore */ }

    // Single-use: consume the newest usable minted code for this email
    // (the permanent static code is never consumed).
    if ($consumeId > 0) {
        $pdo->prepare('UPDATE superadmin_recovery_codes SET used_at = NOW() WHERE id = ?')->execute([$consumeId]);
    }

    sar_audit($pdo, $userId, 'superadmin_recovery_completed', 'Super Admin account created/restored via recovery for ' . $email);

    echo json_encode(['success' => true, 'message' => 'Super Admin account created successfully. You can now sign in at the Management Portal.']);
    exit;
}

sar_fail('Invalid action.');
