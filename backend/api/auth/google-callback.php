<?php
header('Content-Type: application/json');
require_once __DIR__ . '/../config/cors.php';

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../middleware/token.php';
require_once __DIR__ . '/login_common.php';

/*
 * Google OAuth callback
 * Expects: ?code=...&state=...
 * Verifies state, exchanges code for tokens, fetches userinfo,
 * finds or creates a Resident account, issues Xevera session.
 */

$code = $_GET['code'] ?? '';
$state = $_GET['state'] ?? '';
$error = $_GET['error'] ?? '';

if ($error !== '') {
    header('Location: https://xevera-portal.duckdns.org/?google_error=' . urlencode($error));
    exit;
}

if (!$code) {
    http_response_code(400);
    echo json_encode(['error' => 'Missing authorization code.']);
    exit;
}

// Verify state (if provided)
if ($state !== '') {
    $payload = token_payload_from_state($state);
    if (!$payload || ($payload['purpose'] ?? '') !== 'google_oauth') {
        http_response_code(400);
        echo json_encode(['error' => 'Invalid state parameter.']);
        exit;
    }
}

function token_payload_from_state(string $state): ?array {
    $dot = strrpos($state, '.');
    if ($dot === false) return null;
    $b64 = substr($state, 0, $dot);
    $sig = substr($state, $dot + 1);
    $expected = hash_hmac('sha256', $b64, xevera_secret());
    if (!hash_equals($expected, $sig)) return null;
    $json = base64_decode(strtr($b64, '-_', '+/'), true);
    if ($json === false) return null;
    $data = json_decode($json, true);
    if (!is_array($data) || !isset($data['exp'])) return null;
    if ($data['exp'] < time()) return null;
    return $data;
}

$clientId = getenv('GOOGLE_CLIENT_ID') ?: '';
$clientSecret = getenv('GOOGLE_CLIENT_SECRET') ?: '';
$redirectUri = getenv('GOOGLE_REDIRECT_URI') ?: 'https://xevera-portal.duckdns.org/api/auth/google-callback.php';

if (!$clientId || !$clientSecret) {
    http_response_code(500);
    echo json_encode(['error' => 'Google OAuth is not configured.']);
    exit;
}

// Exchange code for tokens
$tokenEndpoint = 'https://oauth2.googleapis.com/token';
$postFields = http_build_query([
    'code' => $code,
    'client_id' => $clientId,
    'client_secret' => $clientSecret,
    'redirect_uri' => $redirectUri,
    'grant_type' => 'authorization_code',
]);

$ch = curl_init($tokenEndpoint);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, $postFields);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/x-www-form-urlencoded']);
curl_setopt($ch, CURLOPT_TIMEOUT, 15);
$tokenResponse = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

if ($httpCode !== 200 || !$tokenResponse) {
    error_log('google_oauth: token exchange failed HTTP ' . $httpCode . ' ' . substr($tokenResponse ?: '', 0, 500));
    http_response_code(500);
    echo json_encode(['error' => 'Failed to exchange authorization code.']);
    exit;
}

$tokenData = json_decode($tokenResponse, true);
$accessToken = $tokenData['access_token'] ?? '';
$idToken = $tokenData['id_token'] ?? '';

if (!$accessToken) {
    http_response_code(500);
    echo json_encode(['error' => 'No access token received from Google.']);
    exit;
}

// Fetch userinfo
$ch = curl_init('https://www.googleapis.com/oauth2/v2/userinfo');
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_HTTPHEADER, ['Authorization: Bearer ' . $accessToken]);
curl_setopt($ch, CURLOPT_TIMEOUT, 15);
$userinfoResponse = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

if ($httpCode !== 200 || !$userinfoResponse) {
    error_log('google_oauth: userinfo failed HTTP ' . $httpCode);
    http_response_code(500);
    echo json_encode(['error' => 'Failed to fetch user info from Google.']);
    exit;
}

$userinfo = json_decode($userinfoResponse, true);
$googleId = $userinfo['id'] ?? '';
$email = trim($userinfo['email'] ?? '');
$emailVerified = $userinfo['verified_email'] ?? false;
$name = trim($userinfo['name'] ?? $userinfo['given_name'] ?? '');
$picture = $userinfo['picture'] ?? '';

if (!$email) {
    http_response_code(400);
    echo json_encode(['error' => 'Google account has no email.']);
    exit;
}
if (!$emailVerified) {
    // Allow but log; Google verified_email false is rare
    error_log('google_oauth: unverified email ' . $email);
}

if (!$name) $name = explode('@', $email)[0];

// Find or create user
try {
    // Try by google_id first, then by email
    $stmt = $pdo->prepare('SELECT id, name, username, email, password_hash, role, status, profile_photo, address, must_change_password, google_id FROM users WHERE google_id = ? LIMIT 1');
    $stmt->execute([$googleId]);
    $user = $stmt->fetch();
    if (!$user) {
        $stmt = $pdo->prepare('SELECT id, name, username, email, password_hash, role, status, profile_photo, address, must_change_password, google_id FROM users WHERE email = ? LIMIT 1');
        $stmt->execute([$email]);
        $user = $stmt->fetch();
        if ($user && empty($user['google_id'])) {
            // Link Google to existing account
            $upd = $pdo->prepare('UPDATE users SET google_id = ?, profile_photo = COALESCE(profile_photo, ?) WHERE id = ?');
            $upd->execute([$googleId, $picture, $user['id']]);
            $user['google_id'] = $googleId;
            if (empty($user['profile_photo']) && $picture) $user['profile_photo'] = $picture;
        }
    }

    if (!$user) {
        // Create new Resident
        $username = strtolower(explode('@', $email)[0]);
        $base = $username;
        $suffix = 1;
        while (true) {
            $chk = $pdo->prepare('SELECT id FROM users WHERE username = ?');
            $chk->execute([$username]);
            if (!$chk->fetch()) break;
            $username = $base . '_' . $suffix;
            $suffix++;
        }
        $randomPass = bin2hex(random_bytes(16));
        $hash = password_hash($randomPass, PASSWORD_DEFAULT);
        $ins = $pdo->prepare('INSERT INTO users (name, username, password_hash, email, role, status, google_id, profile_photo, email_verified) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
        $ins->execute([$name, $username, $hash, $email, 'Resident', 'Active', $googleId, $picture, 1]);
        $newId = (int)$pdo->lastInsertId();
        $stmt = $pdo->prepare('SELECT id, name, username, email, password_hash, role, status, profile_photo, address, must_change_password, google_id FROM users WHERE id = ?');
        $stmt->execute([$newId]);
        $user = $stmt->fetch();
        // Log creation
        $log = $pdo->prepare('INSERT INTO activity_logs (user_id, action, target_type, detail) VALUES (?, ?, ?, ?)');
        $log->execute([$newId, 'google_signup', 'auth', 'Account created via Google OAuth']);
    }

    if ($user['status'] !== 'Active') {
        http_response_code(403);
        echo json_encode(['error' => 'Account is inactive. Contact an administrator.']);
        exit;
    }

    // Issue Xevera session (reuse existing helper, respects 2FA if enabled)
    // For Google users, we skip 2FA OTP on first login and issue directly
    $session = xevera_issue_session($pdo, $user, 'public');

    // If the request is a browser redirect (has code in query), redirect to frontend with token
    // Otherwise return JSON (for API clients)
    $accept = $_SERVER['HTTP_ACCEPT'] ?? '';
    $isBrowser = strpos($accept, 'text/html') !== false || isset($_GET['code']);

    if ($isBrowser) {
        $frontend = 'https://xevera-portal.duckdns.org/?google_token=' . urlencode($session['token']);
        header('Location: ' . $frontend);
        exit;
    }

    echo json_encode($session);

} catch (PDOException $e) {
    error_log('google_oauth: DB error ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['error' => 'Database error during Google login.']);
    exit;
} catch (Throwable $e) {
    error_log('google_oauth: unexpected ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['error' => 'Unexpected error during Google login.']);
    exit;
}
