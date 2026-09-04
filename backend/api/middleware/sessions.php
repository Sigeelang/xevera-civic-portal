<?php
/**
 * Xevera auth/session store -- Phase 0 SKELETON.
 *
 * This file exists only so Phase 1 has stable function signatures to
 * wire against. Every function here is a deliberate no-op stub:
 *
 *   - It does NOT touch the database.
 *   - It does NOT change any auth flow.
 *   - It does NOT introduce a parallel session system.
 *
 * Phase 1 will replace the bodies with the real implementation, and
 * only then will login.php / verify-login-otp.php / requireAuth() start
 * calling into them. Until Phase 1 ships, no caller in the codebase
 * requires this file -- it is dormant.
 *
 * The function set below is the complete surface Phase 1 will need.
 * No functions are added later; only their bodies are filled in.
 */
require_once __DIR__ . '/token.php';

/**
 * Generate a cryptographically opaque session id (32 bytes of random
 * hex, returned as 64 chars). The plaintext lives only in the cookie
 * or the Authorization header; the SHA-256 hash is what is stored.
 */
function xevera_new_session_id(): string {
    return bin2hex(random_bytes(32));
}

/**
 * Hash an opaque session id for storage / lookup. SHA-256 hex = 64 chars.
 * Used for BOTH `sessions.session_id_hash` and `trusted_devices.token_hash`.
 */
function xevera_hash_session_id(string $raw): string {
    return hash('sha256', $raw);
}

/**
 * Phase 0 stub. Phase 1 will INSERT a `sessions` row, set the cookies,
 * and return { session_id, bearer_token, expires_at, absolute_expires_at }.
 * For now: returns null, no side effects.
 */
function xevera_create_session(PDO $pdo, array $user, string $scope, string $authMode = 'unknown', ?int $trustedDeviceId = null): ?array {
    return null; // Phase 0: no behavior change.
}

/**
 * Phase 0 stub. Phase 1 will SELECT the row, validate revoked_at /
 * idle / absolute expiry, and return the session array (or null).
 */
function xevera_load_session(PDO $pdo, string $rawSessionId): ?array {
    return null; // Phase 0: no behavior change.
}

/**
 * Phase 0 stub. Phase 1 will UPDATE `last_activity_at = NOW()` and
 * extend the idle `expires_at` window.
 */
function xevera_touch_session(PDO $pdo, int $sessionId): void {
    // Phase 0: no behavior change.
}

/**
 * Phase 0 stub. Phase 1 will UPDATE `revoked_at = NOW()` and
 * optionally a reason ("logout", "signout_all", "password_change", ...).
 */
function xevera_revoke_session(PDO $pdo, int $sessionId, string $reason = 'logout'): void {
    // Phase 0: no behavior change.
}

/**
 * Phase 0 stub. Phase 1 will UPDATE all non-revoked sessions for a user
 * (and all non-revoked trusted_devices rows) to revoked_at = NOW().
 * Used by "sign out of all devices" and by password change.
 */
function xevera_revoke_all_sessions_for_user(PDO $pdo, int $userId, string $reason): int {
    return 0; // Phase 0: no behavior change.
}

/**
 * Phase 0 stub. Phase 1 will INSERT a `trusted_devices` row, hashing the
 * random token, and return { token, id, expires_at }.
 */
function xevera_create_trusted_device(PDO $pdo, int $userId, string $browserOs, ?string $label, string $ip, string $userAgent, int $ttlDays): ?array {
    return null; // Phase 0: no behavior change.
}

/**
 * Phase 0 stub. Phase 1 will look up by token_hash and return the row
 * only if it is unexpired and not revoked. Used to bypass OTP.
 */
function xevera_load_trusted_device(PDO $pdo, string $rawToken): ?array {
    return null; // Phase 0: no behavior change.
}

/**
 * Phase 0 stub. Phase 1 will UPDATE last_used_at = NOW() on every use.
 */
function xevera_touch_trusted_device(PDO $pdo, int $trustedDeviceId): void {
    // Phase 0: no behavior change.
}

/**
 * Phase 0 stub. Phase 1 will revoke a single trusted device.
 */
function xevera_revoke_trusted_device(PDO $pdo, int $trustedDeviceId, int $userId, string $reason): void {
    // Phase 0: no behavior change.
}

/**
 * Phase 0 stub. Phase 1 will revoke all trusted devices for a user.
 * Returns the count (0 in Phase 0).
 */
function xevera_revoke_all_trusted_devices_for_user(PDO $pdo, int $userId, string $reason): int {
    return 0; // Phase 0: no behavior change.
}

/**
 * Phase 0 stub. Phase 1 will mark a session as having a fresh step-up
 * for a given action class, valid for the configured window.
 */
function xevera_record_stepup(PDO $pdo, int $sessionId, string $actionClass, int $windowMinutes): void {
    // Phase 0: no behavior change.
}

/**
 * Phase 0 stub. Phase 1 will return true if the session's stepup_at for
 * the requested action class is still within the action-specific window.
 */
function xevera_stepup_is_fresh(PDO $pdo, int $sessionId, string $actionClass, int $windowMinutes): bool {
    return false; // Phase 0: fail closed -- Phase 4 will require step-up.
}

/**
 * Phase 0 stub. Returns the trusted-device TTL (in days) for a role
 * based on the new system_settings keys. Will be used in Phase 3.
 * Returns 0 today because nothing calls it yet.
 */
function xevera_trusted_device_days_for_role(string $role): int {
    // Safe default: 0 means "do not offer trusted-device bypass".
    // Phase 3 will read this from system_settings per role.
    return 0;
}
