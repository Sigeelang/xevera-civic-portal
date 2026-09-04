<?php
// Router for PHP built-in server
$uri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);

// Origin-allowlisted CORS headers for every served request.
require_once __DIR__ . '/api/config/cors.php';

/*
 * Never serve secrets, installers, test scripts, logs, dumps, or docs.
 */
$blocked = false;
foreach ([
    '/.env', '/.xevera_secret', '/test_mail.php', '/install_otp_table.php',
    '/create_otp_table.php', '/api/auth/tmp.txt', '/backups/', '/migrations/',
] as $needle) {
    if (str_starts_with($uri, $needle)) { $blocked = true; break; }
}
if (!$blocked && preg_match('/\.(env|log|sql|txt|bat|md|json|lock)$/i', $uri)) {
    $blocked = true;
}
if ($blocked) {
    http_response_code(404);
    echo json_encode(['error' => 'Not found']);
    exit;
}

if (file_exists(__DIR__ . $uri)) {
    return false; // Serve file as-is
}

// Handle API routes - rewrite to actual file
if (str_starts_with($uri, '/api/')) {
    $file = __DIR__ . $uri;
    if (file_exists($file)) {
        require $file;
        return true;
    }
}

// Default: serve index or 404
http_response_code(404);
echo json_encode(['error' => 'Not found']);
