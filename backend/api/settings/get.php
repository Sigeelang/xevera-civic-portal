<?php
/**
 * Public settings endpoint.
 *
 * SECURITY:
 * - Non-sensitive keys (site name, contact info, hero, categories...)
 *   are readable without authentication (public landing pages need them).
 * - Sensitive keys (smtp_*, otp_*) are returned ONLY to the
 *   Super Admin. They are stripped from every other response.
 * - Credentials themselves never live in system_settings; they are
 *   read server-side from .env and are never returned by any API.
 */
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../middleware/token.php';

$sensitivePrefixes = ['smtp_', 'otp_'];
$payload = token_payload();
$isSuperAdmin = $payload !== null
    && ($payload['scope'] ?? '') !== '2fa_pending'
    && ($payload['role'] ?? '') === 'Super Admin';

$stmt = $pdo->query('SELECT `key`, `value` FROM system_settings');
$rows = $stmt->fetchAll();

$settings = [];
foreach ($rows as $r) {
    $key = (string) $r['key'];
    foreach ($sensitivePrefixes as $prefix) {
        if (strpos($key, $prefix) === 0 && !$isSuperAdmin) {
            continue 2; // sensitive key + not Super Admin -> strip
        }
    }
    $settings[$key] = $r['value'];
}

if (isset($settings['categories'])) {
    $settings['categories'] = json_decode($settings['categories'], true) ?? [];
}

echo json_encode($settings);