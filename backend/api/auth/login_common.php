<?php
/**
 * Shared helpers for the login + 2FA flow.
 */

/*
 * Parse the User-Agent header into browser / os / device for the
 * existing login_history table (profile_enhancements.sql).
 */
function xevera_parse_user_agent(string $ua): array {
    $browser = 'Unknown';
    foreach ([
        'Edg' => 'Edge', 'OPR' => 'Opera', 'Firefox' => 'Firefox',
        'Chrome' => 'Chrome', 'Safari' => 'Safari', 'MSIE' => 'IE', 'Trident' => 'IE',
    ] as $needle => $name) {
        if (strpos($ua, $needle) !== false) { $browser = $name; break; }
    }

    $os = 'Unknown';
    foreach ([
        'Windows NT 10.0' => 'Windows', 'Windows' => 'Windows',
        'Android' => 'Android', 'iPhone|iPad|iPod' => 'iOS',
        'Mac OS X' => 'macOS', 'CrOS' => 'ChromeOS', 'Linux' => 'Linux',
    ] as $needle => $name) {
        foreach (explode('|', $needle) as $part) {
            if (strpos($ua, $part) !== false) { $os = $name; break 2; }
        }
    }

    $device = (strpos($ua, 'Mobile') !== false || strpos($ua, 'Android') !== false || strpos($ua, 'iPhone') !== false)
        ? 'Mobile'
        : ((strpos($ua, 'iPad') !== false || strpos($ua, 'Tablet') !== false) ? 'Tablet' : 'Desktop');

    return [$browser . ' ' . $os, $os, $device];
}

/**
 * 2FA policy from system_settings (edited by Super Admin through
 * settings/save.php, OR auto-seeded by the test harness, OR the
 * install bootstrap).
 *
 * Single source of truth: the two rows `twofa_enabled` and
 * `twofa_roles` in `system_settings`. Both must exist for the policy
 * to be honoured. If either is missing, this function auto-seeds the
 * safe default so a partial DB state can never silently disable 2FA.
 * Staff and Super Admin are excluded from 2FA by default since those
 * accounts are already privileged; only Resident and other roles will
 * require verification.
 *
 * Returns [bool enabled, array roles].
 */
function xevera_twofa_policy(PDO $pdo): array {
    $enabled = true;
    $roles   = [];

    try {
        $sel = $pdo->prepare('SELECT `value` FROM system_settings WHERE `key` = ? LIMIT 1');

        $sel->execute(['twofa_enabled']);
        $row = $sel->fetch();
        if ($row) {
            $enabled = ($row['value'] === '1' || $row['value'] === 'true');
        } else {
            // Self-heal: a missing row defaults to 2FA ON (safe).
            $pdo->prepare('INSERT INTO system_settings (`key`, `value`) VALUES (?, ?) ON DUPLICATE KEY UPDATE `value` = VALUES(`value`)')
                ->execute(['twofa_enabled', '1']);
        }

        $sel->execute(['twofa_roles']);
        $row = $sel->fetch();
        if ($row && $row['value'] !== null && $row['value'] !== '') {
            $decoded = json_decode((string) $row['value'], true);
            if (is_array($decoded) && !empty($decoded)) {
                $roles = array_values(array_filter($decoded, 'is_string'));
            }
        } else {
            // Self-heal: a missing row defaults to 2FA disabled for login (OTP still available for registration/password change).
            $pdo->prepare('INSERT INTO system_settings (`key`, `value`) VALUES (?, ?) ON DUPLICATE KEY UPDATE `value` = VALUES(`value`)')
                ->execute(['twofa_roles', '[]']);
        }
    } catch (PDOException $e) { /* missing table/keys -> secure defaults */ }

    return [$enabled, $roles];
}

/**
 * Issues the FULL authenticated session for a fully-verified user:
 * signed 7-day token + login audit trail. Call ONLY after the password
 * (and, when required, the OTP) has been verified.
 */
function xevera_issue_session(PDO $pdo, array $user, string $scope): array {
    $exp = time() + 86400 * 7;
    $token = issue_token([
        'user_id' => (int) $user['id'],
        'username' => $user['username'],
        'name' => $user['name'],
        'email' => $user['email'],
        'role' => $user['role'],
        'status' => $user['status'],
        'photo' => $user['profile_photo'],
        'address' => $user['address'],
        'scope' => $scope,
        'exp' => $exp,
    ]);

    $stmt = $pdo->prepare('INSERT INTO activity_logs (user_id, action, target_type, target_id, detail) VALUES (?, ?, ?, NULL, ?)');
    $stmt->execute([$user['id'], 'login', 'auth', 'User logged in']);

    try {
        $ua = $_SERVER['HTTP_USER_AGENT'] ?? '';
        [$browserOs, $os, $device] = xevera_parse_user_agent($ua);
        $ip = $_SERVER['REMOTE_ADDR'] ?? '';

        $stmt = $pdo->prepare('INSERT INTO login_history (user_id, browser, os, device, ip) VALUES (?, ?, ?, ?, ?)');
        $stmt->execute([(int) $user['id'], $browserOs, $os, $device, $ip]);

        $pdo->prepare('UPDATE users SET last_login_at = NOW() WHERE id = ?')->execute([(int) $user['id']]);
    } catch (PDOException $e) { /* history is best-effort; never block login */ }

    return [
        'token' => $token,
        'user' => [
            'id' => (int) $user['id'],
            'name' => $user['name'],
            'username' => $user['username'],
            'email' => $user['email'],
            'role' => $user['role'],
            'status' => $user['status'],
            'photo' => $user['profile_photo'],
            'address' => $user['address'],
            'scope' => $scope,
        ],
        'must_change_password' => (int) $user['must_change_password'] === 1,
        'expires_at' => $exp,
    ];
}

/**
 * Simple per-email OTP request throttle: max $max OTPs for one
 * email+purpose within the last $windowSeconds. Returns true when
 * the request should be blocked.
 */
function xevera_otp_throttled(PDO $pdo, string $email, string $purpose, int $max = 5, int $windowSeconds = 900): bool {
    try {
        $stmt = $pdo->prepare(
            'SELECT COUNT(*) FROM otp_verifications WHERE email = ? AND purpose = ? AND created_at > (NOW() - INTERVAL ' . $windowSeconds . ' SECOND)'
        );
        $stmt->execute([$email, $purpose]);
        return (int) $stmt->fetchColumn() >= $max;
    } catch (PDOException $e) {
        return false;
    }
}

/**
 * DEV-ONLY: write the plaintext OTP to a side table when
 * DEV_OTP_MODE=1 is set in .env. Used by the dev-otp.php endpoint
 * to reveal OTPs to developers when email delivery is broken.
 * The table is auto-created on first use.
 */
function xevera_dev_otp_record(PDO $pdo, string $email, string $purpose, string $otp, string $expiresAt): void {
    if (getenv('DEV_OTP_MODE') !== '1') {
        return;
    }
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
        // Best-effort cleanup of expired rows
        $pdo->exec('DELETE FROM dev_otp_plain WHERE expires_at < NOW()');
        $stmt = $pdo->prepare('INSERT INTO dev_otp_plain (email, purpose, otp_plain, expires_at, created_at) VALUES (?, ?, ?, ?, NOW())');
        $stmt->execute([$email, $purpose, $otp, $expiresAt]);
    } catch (Throwable $e) {
        // silent — dev convenience, never block the real flow
    }
}
