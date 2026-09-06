<?php
/**
 * Safe email/OTP configuration status for the Super Admin.
 *
 * SECURITY: Never returns passwords, app passwords, secrets or keys.
 * Only presence/configured flags and non-sensitive values (host, port, from).
 */
header('Content-Type: application/json');
require_once __DIR__ . '/../config/cors.php';

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }

require_once __DIR__ . '/../middleware/auth.php';
requireRole(['Super Admin']);

require_once __DIR__ . '/../config/mailer.php';
require_once __DIR__ . '/../config/database.php';

// Shared validation from mailer.php - single source of truth.
[, , , $smtpConfigured] = xevera_smtp_credentials();

// Check if SES API is available (AWS SDK + IAM role)
$sesApiAvailable = false;
$vendorPath = __DIR__ . '/../../vendor/autoload.php';
if (file_exists($vendorPath)) {
    try {
        require_once $vendorPath;
        if (class_exists(Aws\Sdk::class)) {
            $region = getenv('AWS_SES_REGION') ?: 'ap-southeast-2';
            $sdk = new Aws\Sdk(['region' => $region, 'version' => 'latest']);
            $sesClient = $sdk->createSES();
            $identities = $sesClient->listIdentities();
            $sesApiAvailable = true;
        }
    } catch (Throwable $e) { /* SES API not available */ }
}

$emailReady = $smtpConfigured || $sesApiAvailable;

// Mask the mailbox: show only the first 2 characters and the domain.
$user = defined('MAIL_USER') ? (string)constant('MAIL_USER') : '';
$atPos = strpos($user, '@');
$mailboxMasked = $user === ''
    ? null
    : ($atPos !== false ? substr($user, 0, 2) . '***' . substr($user, $atPos) : '***');

// Derive the transport security label from the host scheme or port.
$host = defined('MAIL_HOST') ? (string)constant('MAIL_HOST') : '';
$port = defined('MAIL_PORT') ? (int)constant('MAIL_PORT') : 0;
if (strpos($host, 'ssl://') === 0) {
    $security = 'SSL';
} elseif (strpos($host, 'tls://') === 0) {
    $security = 'TLS';
} elseif ($port === 587 && stripos($host, 'email-smtp') !== false) {
    $security = 'STARTTLS';
} else {
    $security = 'None';
}

// OTP support: the OTP codes table installed via install_otp_table.php.
$otpTableExists = false;
try {
    $stmt = $pdo->query("SHOW TABLES LIKE 'otp_verifications'");
    $otpTableExists = $stmt->fetchColumn() !== false;
} catch (PDOException $e) { /* table listing failed - report as unknown */ }

// Last successful SMTP test (written by settings/test_smtp.php).
$lastTestedAt = null;
try {
    $stmt = $pdo->prepare("SELECT `value` FROM system_settings WHERE `key` = 'smtp_last_tested_at'");
    $stmt->execute();
    $row = $stmt->fetch();
    if ($row && !empty($row['value'])) {
        $lastTestedAt = $row['value'];
    }
} catch (PDOException $e) { /* status key missing - treat as never tested */ }

// READY means codes can be generated AND actually delivered by email.
$otpReady = $otpTableExists && $emailReady && $lastTestedAt !== null;

echo json_encode([
    'smtp' => [
        'host' => $host,
        'port' => defined('MAIL_PORT') ? constant('MAIL_PORT') : null,
        'from' => defined('MAIL_FROM') ? constant('MAIL_FROM') : null,
        'username_masked' => $mailboxMasked,
        'password_configured' => $smtpConfigured,
        'configured' => $emailReady,
        'last_tested_at' => $lastTestedAt,
        'status' => $emailReady ? 'Connected' : 'Not configured',
        'security' => $sesApiAvailable ? 'SES API (IAM)' : $security,
        'transport' => $sesApiAvailable ? 'ses_api' : 'smtp',
    ],
    'otp' => [
        'enabled' => $otpTableExists,
        'ready' => $otpReady,
        'delivery' => 'Email',
        'expires_minutes' => 10,
        'note' => !$otpTableExists
            ? 'OTP table is not installed. Run backend/install_otp_table.php to enable OTP functionality.'
            : ($otpReady
                ? 'OTP service is ready. Codes are stored hashed and delivered by email.'
                : 'OTP codes can be generated, but email delivery requires a working SMTP configuration.'),
    ],
]);
