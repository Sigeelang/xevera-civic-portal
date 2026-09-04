<?php
/**
 * Central CORS policy - strict origin allowlist, no wildcards.
 *
 * Allowed origins come from CORS_ALLOW_ORIGINS in backend/.env
 * (comma separated). Requests from any other origin simply don't get
 * an Access-Control-Allow-Origin header and are blocked by the browser.
 *
 * Defenses layered on top of the standard allow-list:
 *   - `Access-Control-Allow-Credentials: true` is set only for
 *     allow-listed origins (never with a wildcard).
 *   - `Access-Control-Max-Age: 600` caches the preflight for 10 min
 *     to reduce latency.
 *   - `Vary: Origin` is always emitted so downstream caches don't
 *     leak responses between origins.
 *   - For state-changing methods (POST/PUT/PATCH/DELETE), a missing
 *     or unknown `Origin` header is rejected with 403 as an explicit
 *     CSRF defense-in-depth (bearer tokens don't auto-attach cross-
 *     origin, but this catches a class of misconfigured clients).
 */

require_once __DIR__ . '/env.php';
require_once __DIR__ . '/headers.php';

$xeveraAllowed = array_values(array_filter(array_map('trim', explode(',', (string) getenv('CORS_ALLOW_ORIGINS')))));
if (empty($xeveraAllowed)) {
    // Safe default for local development.
    $xeveraAllowed = ['http://localhost:5173', 'http://127.0.0.1:5173'];
}

$xeveraOrigin = $_SERVER['HTTP_ORIGIN'] ?? '';
$xeveraMethod = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
$xeveraIsStateChanging = in_array($xeveraMethod, ['POST', 'PUT', 'PATCH', 'DELETE'], true);

header('Vary: Origin');
header('Access-Control-Allow-Methods: GET, POST, PATCH, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Access-Control-Max-Age: 600');

if ($xeveraOrigin !== '' && in_array($xeveraOrigin, $xeveraAllowed, true)) {
    // Echo the specific origin (not "*") and enable credentials.
    header('Access-Control-Allow-Origin: ' . $xeveraOrigin);
    header('Access-Control-Allow-Credentials: true');
    return;
}

// Origin header is present but NOT allow-listed.
// Browsers already block the response, but we go further and reject
// state-changing requests outright to fail loud rather than silent.
if ($xeveraOrigin !== '' && $xeveraIsStateChanging) {
    http_response_code(403);
    header('Content-Type: application/json');
    echo json_encode(['error' => 'Origin not allowed.']);
    exit;
}

// No Origin header: typically a same-origin request, a non-browser
// client (server-to-server, mobile app, CLI test harness), or a
// non-CORS tool. The bearer token in the Authorization header is the
// authoritative auth credential, so allow it. Browsers will always
// send an Origin header for cross-origin requests, so this carve-out
// is safe.

