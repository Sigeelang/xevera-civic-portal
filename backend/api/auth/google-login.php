<?php
header('Content-Type: application/json');
require_once __DIR__ . '/../config/cors.php';

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }

require_once __DIR__ . '/../middleware/token.php';

$clientId = getenv('GOOGLE_CLIENT_ID') ?: '';
$redirectUri = getenv('GOOGLE_REDIRECT_URI') ?: 'https://xevera-portal.duckdns.org/api/auth/google-callback.php';

if (!$clientId) {
    if ($_SERVER['REQUEST_METHOD'] === 'GET' && !isset($_GET['json'])) {
        header('Location: https://xevera-portal.duckdns.org/?google_error=' . urlencode('Google sign-in is not configured yet'));
        exit;
    }
    http_response_code(503);
    echo json_encode(['error' => 'Google sign-in is not configured yet. Please use email and password.']);
    exit;
}

// Generate state for CSRF protection (10 min expiry)
$statePayload = [
    'purpose' => 'google_oauth',
    'nonce' => bin2hex(random_bytes(16)),
    'exp' => time() + 600,
];
$b64 = rtrim(strtr(base64_encode(json_encode($statePayload)), '+/', '-_'), '=');
$sig = hash_hmac('sha256', $b64, xevera_secret());
$state = $b64 . '.' . $sig;

$scope = 'openid email profile';
$authUrl = 'https://accounts.google.com/o/oauth2/v2/auth?' . http_build_query([
    'client_id' => $clientId,
    'redirect_uri' => $redirectUri,
    'response_type' => 'code',
    'scope' => $scope,
    'access_type' => 'offline',
    'prompt' => 'select_account',
    'state' => $state,
]);

// If called as GET from browser, redirect directly
if ($_SERVER['REQUEST_METHOD'] === 'GET' && !isset($_GET['json'])) {
    header('Location: ' . $authUrl);
    exit;
}

echo json_encode(['auth_url' => $authUrl, 'state' => $state]);
