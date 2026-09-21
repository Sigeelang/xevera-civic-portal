<?php
/**
 * Save system settings - Super Admin only.
 *
 * SECURITY: strict key allowlist. Arbitrary key/value writes would let a
 * compromised Super Admin session (or a future bug) plant unexpected
 * values into every page that reads system_settings.
 */
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once __DIR__ . '/../middleware/auth.php';
$currentUser = requirePermission('system-settings', ['Super Admin']);

require_once __DIR__ . '/../config/database.php';

/*
 * Allowlisted setting keys:
 *  - General site settings (System Settings page)
 *  - Report categories / status configuration
 * SMTP credentials are NOT writable here - they live only in backend/.env.
 */
$allowed_keys = [
    'site_name',
    'contact_email',
    'contact_phone',
    'barangay_address',
    'hero_title',
    'hero_subtitle',
    'registration_enabled',
    'categories',
    'status_config',
    // 2FA policy (single source of truth read by xevera_twofa_policy()).
    // The Super Admin 2FA Policy card writes through these two keys.
    'twofa_enabled',
    'twofa_roles',
    // Two-Factor Control per role
    '2fa_email_otp_super_admin',
    '2fa_email_otp_admin',
    '2fa_email_otp_staff',
    '2fa_email_otp_resident',
    // 2FA trusted device + session settings
    '2fa_trusted_days',
    'session_inactivity_minutes',
];

$input = json_decode(file_get_contents('php://input'), true);
$settings = $input['settings'] ?? [];

if (empty($settings) || !is_array($settings)) {
    http_response_code(400);
    echo json_encode(['error' => 'No settings provided.']);
    exit;
}

$stmt = $pdo->prepare('INSERT INTO system_settings (`key`, `value`) VALUES (?, ?) ON DUPLICATE KEY UPDATE `value` = VALUES(`value`)');
$updated = [];
$rejected = [];

foreach ($settings as $key => $value) {
    if (!in_array((string) $key, $allowed_keys, true)) {
        $rejected[] = (string) $key;
        continue;
    }
    if (is_array($value)) {
        $value = json_encode($value);
    }
    $stmt->execute([$key, (string) $value]);
    $updated[] = $key;
}

$logStmt = $pdo->prepare('INSERT INTO activity_logs (user_id, action, target_type, target_id, detail) VALUES (?, ?, ?, NULL, ?)');
$logStmt->execute([$currentUser['user_id'], 'update_settings', 'settings', 'Updated: ' . implode(', ', $updated)]);

echo json_encode([
    'message' => 'Settings saved.',
    'updated' => $updated,
    'rejected' => $rejected,
]);