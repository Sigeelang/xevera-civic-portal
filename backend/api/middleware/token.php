<?php
require_once __DIR__ . '/../config/env.php';

/**
 * Token secret resolution order:
 *   1. APP_KEY from backend/.env or real environment (preferred).
 *   2. A generated 64-hex secret persisted OUTSIDE the web root
 *      (project root /.xevera_secret) so local installs have a stable
 *      secret without hardcoding one in source.
 */
function xevera_secret(): string {
    if (isset($GLOBALS['XEVERA_APP_SECRET']) && $GLOBALS['XEVERA_APP_SECRET'] !== '') {
        return $GLOBALS['XEVERA_APP_SECRET'];
    }

    $env = getenv('APP_KEY');
    if ($env && strlen($env) >= 32) {
        $GLOBALS['XEVERA_APP_SECRET'] = $env;
        return $env;
    }

    // No APP_KEY configured: fall back to a local secret file. This is fine
    // for development, but production MUST set APP_KEY (64 hex chars, outside
    // the repo, e.g. via Secrets Manager) or all sessions die on redeploy.
    // The warning below makes a missing production secret visible in logs.
    error_log('xevera_auth: APP_KEY not set - using local .xevera_secret fallback. Set APP_KEY in production.');

    // D:\GAMES\Prototpye 4\.xevera_secret (outside the backend document root)
    $root = dirname(__DIR__, 3);
    $file = $root . DIRECTORY_SEPARATOR . '.xevera_secret';

    if (is_file($file)) {
        $secret = trim((string)file_get_contents($file));
        if (strlen($secret) >= 32) {
            $GLOBALS['XEVERA_APP_SECRET'] = $secret;
            return $secret;
        }
    }

    $secret = bin2hex(random_bytes(32));
    @file_put_contents($file, $secret, LOCK_EX);
    $GLOBALS['XEVERA_APP_SECRET'] = $secret;
    return $secret;
}

function xevera_encode_b64(string $payload): string {
    return rtrim(strtr(base64_encode($payload), '+/', '-_'), '=');
}

function xevera_decode_b64(string $payload): ?string {
    $s = strtr($payload, '-_', '+/');
    $pad = strlen($s) % 4;
    if ($pad) $s .= str_repeat('=', 4 - $pad);
    $decoded = base64_decode($s, true);
    return $decoded === false ? null : $decoded;
}

/**
 * Builds a signed token: "<base64url(json)>.<hmac-sha256-hex>"
 *
 * Every token carries a random `jti` (JWT ID) so individual sessions can
 * be revoked: auth/logout.php stores the jti in `token_blacklist`, and
 * requireAuth() rejects blacklisted jtis. Tokens issued before jti
 * existed (no jti claim) skip the blacklist check and stay valid until
 * their `exp` - they age out within 7 days.
 */
function issue_token(array $payload): string {
    if (empty($payload['jti']) || !is_string($payload['jti'])) {
        $payload['jti'] = bin2hex(random_bytes(16));
    }
    $b64 = xevera_encode_b64(json_encode($payload));
    $sig = hash_hmac('sha256', $b64, xevera_secret());
    return $b64 . '.' . $sig;
}

/**
 * Parses and verifies a Bearer token from the request headers.
 * Returns the payload array, or null when the header is missing/invalid/expired.
 */
function token_payload(): ?array {
    $headers = function_exists('getallheaders') ? getallheaders() : [];
    $token = $headers['Authorization'] ?? $headers['authorization'] ?? '';

    if (!preg_match('/^Bearer\s+([A-Za-z0-9\-_.]+)$/i', $token, $matches)) return null;

    $dot = strrpos($matches[1], '.');
    if ($dot === false) return null;

    $b64 = substr($matches[1], 0, $dot);
    $sig = substr($matches[1], $dot + 1);

    $expected = hash_hmac('sha256', $b64, xevera_secret());
    if (!hash_equals($expected, $sig)) return null;

    $json = xevera_decode_b64($b64);
    if ($json === null) return null;

    $data = json_decode($json, true);
    if (!is_array($data) || !isset($data['user_id']) || !isset($data['exp'])) return null;
    if ($data['exp'] < time()) return null;

    return $data;
}

/**
 * Returns true when the given token jti has been revoked via logout.
 * Takes PDO as a parameter so this helper never includes database.php
 * itself (callers already own the connection).
 */
function xevera_token_revoked(PDO $pdo, string $jti): bool {
    if ($jti === '' || strlen($jti) > 64) return false;
    try {
        $stmt = $pdo->prepare('SELECT 1 FROM token_blacklist WHERE jti = ? LIMIT 1');
        $stmt->execute([$jti]);
        return (bool) $stmt->fetchColumn();
    } catch (Throwable $e) {
        // Fail closed is decided by the caller (requireAuth denies).
        throw $e;
    }
}