<?php
/*
 * Mint (or revoke) Super Admin emergency recovery codes.
 *
 * The plaintext code is printed ONCE and can never be retrieved again
 * (only a bcrypt hash is stored). Deliver it to the authorized official
 * through a secure out-of-band channel.
 *
 * CLI ONLY — run over SSH on the server:
 *   php generate-recovery-code.php <official-email> [--days=3]
 *   php generate-recovery-code.php --revoke <official-email>
 *
 * Minting invalidates previously unused codes for the same email.
 */

if (php_sapi_name() !== 'cli') {
    http_response_code(403);
    echo json_encode(['error' => 'CLI only.']);
    exit;
}

require_once __DIR__ . '/../api/config/database.php';

$args = array_slice($argv, 1);
$revoke = false;
$email = '';
$days = 3;

foreach ($args as $a) {
    if ($a === '--revoke') { $revoke = true; continue; }
    if (str_starts_with($a, '--days=')) { $days = max(1, min(30, (int)substr($a, 7))); continue; }
    if ($email === '' && !str_starts_with($a, '--')) $email = strtolower(trim($a));
}

if ($email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
    fwrite(STDERR, "Usage:\n  php generate-recovery-code.php <official-email> [--days=3]\n  php generate-recovery-code.php --revoke <official-email>\n");
    exit(2);
}

if ($revoke) {
    $stmt = $pdo->prepare('DELETE FROM superadmin_recovery_codes WHERE email = ? AND used_at IS NULL');
    $stmt->execute([$email]);
    echo 'Revoked ' . $stmt->rowCount() . ' unused code(s) for ' . $email . PHP_EOL;
    exit(0);
}

// User-friendly alphabet: lowercase, no ambiguous chars, survives the
// portal input sanitizer (which strips everything but [a-z0-9]).
$alphabet = 'abcdefghjkmnpqrstuvwxyz23456789';
$code = '';
for ($i = 0; $i < 16; $i++) {
    $code .= $alphabet[random_int(0, strlen($alphabet) - 1)];
}

// Rotation: destroy unused predecessors so only the newest code works.
$pdo->prepare('DELETE FROM superadmin_recovery_codes WHERE email = ? AND used_at IS NULL')->execute([$email]);

$expires = date('Y-m-d H:i:s', time() + $days * 86400);
$pdo->prepare('INSERT INTO superadmin_recovery_codes (email, code_hash, expires_at) VALUES (?, ?, ?)')
    ->execute([$email, password_hash($code, PASSWORD_DEFAULT), $expires]);

echo 'Recovery code for ' . $email . PHP_EOL;
echo 'Code (shown ONCE — store it securely now): ' . $code . PHP_EOL;
echo 'Expires: ' . $expires . ' (Asia/Manila)' . PHP_EOL;
echo 'Portal: https://xevera-portal.duckdns.org/system-aut' . PHP_EOL;
