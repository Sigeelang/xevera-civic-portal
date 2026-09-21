<?php
require_once __DIR__ . '/token.php';
require_once __DIR__ . '/../config/database.php';

function requireAuth(): array {
    $payload = token_payload();
    if (!$payload) {
        http_response_code(401);
        echo json_encode(['error' => 'Unauthorized. No valid token provided.']);
        exit;
    }

    /*
     * A "2fa_pending" token is a pre-authentication artifact issued by
     * auth/login.php. It must never grant access to any API - only
     * auth/verify-login-otp.php may consume it, after OTP verification.
     */
    if (($payload['scope'] ?? '') === '2fa_pending') {
        http_response_code(401);
        echo json_encode(['error' => 'Unauthorized. Verification required.']);
        exit;
    }

    /*
     * Per-request account status check: a deactivated/disabled account
     * loses access immediately instead of waiting for token expiry.
     * If the status lookup fails for any reason, the request is denied
     * to maintain fail-closed security.
     *
     * Session revocation check: auth/logout.php stores the token's jti
     * in `token_blacklist`. A blacklisted token is rejected here even
     * though its signature is still valid and it has not expired.
     * Tokens issued before jti existed carry no jti claim and skip this
     * check - they age out at their `exp` (max 7 days).
     */
    try {
        global $pdo;
        if (!isset($pdo)) require_once __DIR__ . '/../config/database.php';
        try {
            $stmt = $pdo->prepare('SELECT status, suspension_until FROM users WHERE id = ? LIMIT 1');
            $stmt->execute([(int) $payload['user_id']]);
            $row = $stmt->fetch();
        } catch (Throwable $e) {
            // Older schemas without suspension_until: status only.
            $stmt = $pdo->prepare('SELECT status FROM users WHERE id = ? LIMIT 1');
            $stmt->execute([(int) $payload['user_id']]);
            $r = $stmt->fetch();
            $row = $r ? ['status' => $r['status'], 'suspension_until' => null] : false;
        }
        $status = $row ? $row['status'] : false;
        /*
         * Suspensions lift themselves: when the suspension window has
         * passed, reactivate the account on the spot instead of locking
         * the resident out forever. Accounts deactivated for any other
         * reason (no suspension_until) stay blocked.
         */
        if ($status !== false && $status !== 'Active') {
            $suspUntil = $row ? ($row['suspension_until'] ?? null) : null;
            if ($suspUntil && strtotime((string)$suspUntil) <= time()) {
                try {
                    $pdo->prepare("UPDATE users SET status = 'Active', suspension_until = NULL WHERE id = ?")->execute([(int)$payload['user_id']]);
                    $status = 'Active';
                } catch (Throwable $e) {
                    error_log('[auth.php] suspension lift failed: ' . $e->getMessage());
                }
            }
        }
        if ($status !== false && $status !== 'Active') {
            http_response_code(403);
            echo json_encode(['error' => 'Account is inactive. Contact an administrator.']);
            exit;
        }

        if (!empty($payload['jti']) && is_string($payload['jti'])) {
            $chk = $pdo->prepare('SELECT 1 FROM token_blacklist WHERE jti = ? LIMIT 1');
            $chk->execute([(string) $payload['jti']]);
            if ($chk->fetchColumn()) {
                http_response_code(401);
                echo json_encode(['error' => 'Session has been revoked. Please log in again.']);
                exit;
            }
        }
    } catch (Throwable $e) {
        // Log technical details for debugging (never exposed to user)
        error_log('[auth.php] DB status check failed: ' . $e->getMessage());
        http_response_code(403);
        echo json_encode(['error' => 'Account status check failed. Access denied.']);
        exit;
    }

    /*
     * Maintenance mode: residents are signed out automatically while
     * maintenance is ON. Their API calls are rejected (401 clears the
     * stored token client-side via apiFetch), and the frontend also
     * forces a logout + redirect. Staff/Admin/Super Admin keep access.
     */
    try {
        if (($payload['role'] ?? '') === 'Resident') {
            $mStmt = $pdo->prepare('SELECT `value` FROM system_settings WHERE `key` = ? LIMIT 1');
            $mStmt->execute(['maintenance_mode']);
            $mRow = $mStmt->fetch();
            if ($mRow && ($mRow['value'] === '1' || $mRow['value'] === 'true')) {
                http_response_code(401);
                echo json_encode(['error' => 'System is under maintenance. You have been signed out. Please try again later.']);
                exit;
            }
        }
    } catch (Throwable $e) {
        // Fail-closed only for residents when the check itself errors.
        if (($payload['role'] ?? '') === 'Resident') {
            error_log('[auth.php] maintenance check failed: ' . $e->getMessage());
            http_response_code(401);
            echo json_encode(['error' => 'System is under maintenance. You have been signed out. Please try again later.']);
            exit;
        }
    }

    return $payload;
}

function requireRole(array $allowedRoles): array {
    $user = requireAuth();
    $role = $user['role'] ?? '';

    if (!in_array($role, $allowedRoles, true)) {
        http_response_code(403);
        echo json_encode(['error' => 'Forbidden. You do not have permission to access this resource.']);
        exit;
    }

    return $user;
}

/*
 * Editable role permissions (deny-override model).
 *
 * The code-level $fallbackRoles passed at each call site define the
 * maximum ever allowed. Super Admins may additionally REVOKE whole
 * modules per role (Admin / Staff) via admin/permissions.php; those
 * denials live in `role_permission_denials` and are enforced here.
 * Re-enabling simply deletes the denial, restoring code behavior, so
 * this layer can never grant anything the code does not already allow
 * and can never lock out Super Admin.
 */
function xevera_permission_denied(string $role, string $module): bool {
    if ($role !== 'Admin' && $role !== 'Staff') {
        return false;
    }
    try {
        global $pdo;
        if (!isset($pdo)) require_once __DIR__ . '/../config/database.php';
        $stmt = $pdo->prepare('SELECT 1 FROM role_permission_denials WHERE role = ? AND module = ? LIMIT 1');
        $stmt->execute([$role, $module]);
        return (bool)$stmt->fetchColumn();
    } catch (Throwable $e) {
        // Fail-closed to code behavior when the table is missing/unreadable.
        return false;
    }
}

function requirePermission(string $module, array $fallbackRoles): array {
    $user = requireAuth();
    $role = $user['role'] ?? '';

    if ($role === 'Super Admin') {
        return $user;
    }

    if (xevera_permission_denied($role, $module)) {
        http_response_code(403);
        echo json_encode(['error' => 'Forbidden. Your role no longer has access to this module.']);
        exit;
    }

    if (!in_array($role, $fallbackRoles, true)) {
        http_response_code(403);
        echo json_encode(['error' => 'Forbidden. You do not have permission to access this resource.']);
        exit;
    }

    return $user;
}