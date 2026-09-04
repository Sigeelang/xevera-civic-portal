<?php
header('Content-Type: application/json');
require_once __DIR__ . '/../config/cors.php';

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once __DIR__ . '/../middleware/auth.php';
$user = requireAuth();

require_once __DIR__ . '/../config/database.php';

/*
 * Session revocation: store this token's jti in `token_blacklist` so the
 * Bearer token stops working immediately, not just when the frontend
 * deletes its copy. requireAuth() rejects blacklisted jtis on every
 * authenticated request (frontend apiFetch also clears the token on 401).
 * Tokens without a jti claim (issued before revocation existed) cannot be
 * revoked individually - they expire on their own (max 7 days).
 */
try {
    if (!empty($user['jti']) && is_string($user['jti'])) {
        $chk = $pdo->prepare('SELECT 1 FROM token_blacklist WHERE jti = ? LIMIT 1');
        $chk->execute([(string) $user['jti']]);
        if (!$chk->fetchColumn()) {
            $ins = $pdo->prepare('INSERT INTO token_blacklist (jti, user_id, revoked_at) VALUES (?, ?, NOW())');
            $ins->execute([(string) $user['jti'], (int) $user['user_id']]);
        }
    }
    // Hygiene: drop revocations older than 30 days (all such tokens expired anyway).
    $pdo->exec("DELETE FROM token_blacklist WHERE revoked_at < (NOW() - INTERVAL 30 DAY)");
} catch (Throwable $e) {
    // Revocation failure must not block the logout response itself, but it
    // must be loud server-side so a broken blacklist never goes unnoticed.
    error_log('xevera_logout: token revocation failed: ' . $e->getMessage());
}

$stmt = $pdo->prepare('INSERT INTO activity_logs (user_id, action, target_type, detail) VALUES (?, ?, ?, ?)');
$stmt->execute([$user['user_id'], 'logout', 'auth', 'User logged out']);

echo json_encode(['message' => 'Logged out successfully.']);
