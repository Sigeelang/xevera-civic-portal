<?php
/**
 * SMTP diagnostics for the Super Admin Email/OTP settings page.
 *
 * Actions:
 *   test_connection  - verify host reachability + authentication (sends nothing)
 *   send_test_email  - deliver a test message to a given address
 *
 * SECURITY: credentials never leave the server; the password is read
 * from mail_config.php only.
 */
header('Content-Type: application/json');

// Read php://input BEFORE any requires (stream is one-shot)
$input = json_decode(file_get_contents('php://input'), true);
$action = trim($input['action'] ?? '');

require_once __DIR__ . '/../config/cors.php';

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

require_once __DIR__ . '/../middleware/auth.php';
require_once __DIR__ . '/../middleware/write_ratelimit.php';
$currentUser = requireRole(['Super Admin']);
xevera_write_rate_limit($pdo, 'smtp.test');

require_once __DIR__ . '/../config/mailer.php';
require_once __DIR__ . '/../config/database.php';

if ($action === 'test_connection') {
    // Try SES API first, then SMTP
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

    if ($sesApiAvailable) {
        $logStmt = $pdo->prepare('INSERT INTO activity_logs (user_id, action, target_type, target_id, detail) VALUES (?, ?, ?, NULL, ?)');
        $logStmt->execute([$currentUser['user_id'], 'test_smtp', 'settings', 'SES API connection succeeded']);

        try {
            $stmt = $pdo->prepare('INSERT INTO system_settings (`key`, `value`) VALUES (?, ?) ON DUPLICATE KEY UPDATE `value` = VALUES(`value`)');
            $stmt->execute(['smtp_last_tested_at', date('Y-m-d H:i:s')]);
        } catch (PDOException $e) { /* persistence is best-effort */ }

        echo json_encode([
            'success' => true,
            'message' => 'SES API connection successful (via IAM role).',
            'transport' => 'ses_api',
            'region' => getenv('AWS_SES_REGION') ?: 'ap-southeast-2',
        ]);
        exit;
    }

    // Fallback to SMTP test
    [$ok, $error] = xevera_smtp_test_connection();

    $logStmt = $pdo->prepare('INSERT INTO activity_logs (user_id, action, target_type, target_id, detail) VALUES (?, ?, ?, NULL, ?)');
    $logStmt->execute([$currentUser['user_id'], 'test_smtp', 'settings', $ok ? 'SMTP test connection succeeded' : 'SMTP test connection failed']);

    if (!$ok) {
        http_response_code(502);
        echo json_encode(['success' => false, 'error' => $error]);
        exit;
    }

    /*
     * Persist the last successful test so the Email/OTP settings page can
     * distinguish CONFIGURED-NOT-TESTED from CONNECTED across sessions.
     * Uses the existing system_settings key/value table - no schema change.
     */
    try {
        $stmt = $pdo->prepare('INSERT INTO system_settings (`key`, `value`) VALUES (?, ?) ON DUPLICATE KEY UPDATE `value` = VALUES(`value`)');
        $stmt->execute(['smtp_last_tested_at', date('Y-m-d H:i:s')]);
    } catch (PDOException $e) { /* persistence is best-effort */ }

    echo json_encode([
        'success' => true,
        'message' => 'SMTP connection and authentication successful.',
        'server' => MAIL_HOST . ':' . MAIL_PORT,
        'security' => strpos(MAIL_HOST, 'ssl://') === 0 ? 'SSL' : (strpos(MAIL_HOST, 'tls://') === 0 ? 'TLS' : 'None'),
    ]);
    exit;
}

if ($action === 'send_test_email') {
    $to = trim($input['to'] ?? '');
    if (!filter_var($to, FILTER_VALIDATE_EMAIL)) {
        http_response_code(400);
        echo json_encode(['error' => 'A valid recipient email address is required.']);
        exit;
    }

    // Check SES API availability
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

    if (!$sesApiAvailable) {
        [$connOk, $connError] = xevera_smtp_test_connection();
        if (!$connOk) {
            http_response_code(502);
            echo json_encode(['success' => false, 'error' => $connError]);
            exit;
        }
    }

    $siteName = getenv('APP_NAME') ?: 'Xevera Portal';
    $body = "Hello,\r\n\r\n"
          . "This is a test email from {$siteName}.\r\n"
          . "If you received this message, your email configuration is working.\r\n\r\n"
          . " regards,\r\n"
          . "{$siteName} Team\r\n";

    $ok = xevera_mail($to, 'SMTP Test Email', $body);

    $masked = substr($to, 0, 2) . '***' . substr($to, strpos($to, '@'));
    $queued = function_exists('xevera_mail_queue_count') ? xevera_mail_queue_count() : 0;
    $logStmt = $pdo->prepare('INSERT INTO activity_logs (user_id, action, target_type, target_id, detail) VALUES (?, ?, ?, NULL, ?)');
    $logStmt->execute([$currentUser['user_id'], 'test_smtp', 'settings', $ok ? "Test email sent to {$masked}" : "Test email to {$masked} queued (queued=$queued)"]);

    if (!$ok) {
        if ($queued > 0) {
            echo json_encode(['success' => true, 'queued' => true, 'message' => "Test email queued for {$masked} due to Gmail daily limit (550). It will be sent when the limit resets or via Super Admin retry at /api/settings/mail_queue.php?action=retry. Queue size: $queued.", 'to_masked' => $masked, 'queued' => $queued]);
            exit;
        }
        http_response_code(502);
        echo json_encode(['success' => false, 'error' => 'The server could not deliver the test email. Gmail daily limit exceeded (550). Check /var/www/xevera/backend/storage/mail_queue/ and retry via mail_queue.php.']);
        exit;
    }

    // A delivered email also proves the SMTP configuration works.
    try {
        $stmt = $pdo->prepare('INSERT INTO system_settings (`key`, `value`) VALUES (?, ?) ON DUPLICATE KEY UPDATE `value` = VALUES(`value`)');
        $stmt->execute(['smtp_last_tested_at', date('Y-m-d H:i:s')]);
    } catch (PDOException $e) { /* persistence is best-effort */ }

    echo json_encode([
        'success' => true,
        'message' => "Test email sent successfully to {$masked}.",
        'to_masked' => $masked,
    ]);
    exit;
}

if ($action === 'send_test_otp') {
    // Check SES API availability
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

    if (!$sesApiAvailable) {
        [$connOk, $connError] = xevera_smtp_test_connection();
        if (!$connOk) {
            http_response_code(502);
            echo json_encode(['success' => false, 'error' => $connError]);
            exit;
        }
    }

    $to = defined('MAIL_USER') ? (string)constant('MAIL_USER') : '';
    if (!filter_var($to, FILTER_VALIDATE_EMAIL)) {
        // When using SES API, MAIL_USER may not be an email - use MAIL_FROM instead
        $to = defined('MAIL_FROM') ? (string)constant('MAIL_FROM') : '';
    }
    if (!filter_var($to, FILTER_VALIDATE_EMAIL)) {
        http_response_code(400);
        echo json_encode(['error' => 'No configured mailbox to send the test OTP to.']);
        exit;
    }

    $code = str_pad((string)random_int(0, 999999), 6, '0', STR_PAD_LEFT);

    $siteName = getenv('APP_NAME') ?: 'Xevera Portal';
    $body = "Hello,\r\n\r\n"
          . "This is a test one-time password from {$siteName}.\r\n"
          . "It verifies that the OTP email delivery pipeline is working.\r\n\r\n"
          . "Your test code: {$code}\r\n\r\n"
          . "(This code is for testing only and is NOT stored or valid for login.)\r\n\r\n"
          . " regards,\r\n"
          . "{$siteName} Team\r\n";

    $ok = xevera_mail($to, 'Xevera Test OTP', $body);

    $masked = substr($to, 0, 2) . '***' . substr($to, strpos($to, '@'));
    $logStmt = $pdo->prepare('INSERT INTO activity_logs (user_id, action, target_type, target_id, detail) VALUES (?, ?, ?, NULL, ?)');
    $logStmt->execute([$currentUser['user_id'], 'test_smtp', 'settings', $ok ? "Test OTP sent to {$masked}" : "Test OTP to {$masked} failed"]);

    if (!$ok) {
        http_response_code(502);
        echo json_encode(['success' => false, 'error' => 'The server could not deliver the test OTP. Check mail server logs.']);
        exit;
    }

    try {
        $stmt = $pdo->prepare('INSERT INTO system_settings (`key`, `value`) VALUES (?, ?) ON DUPLICATE KEY UPDATE `value` = VALUES(`value`)');
        $stmt->execute(['smtp_last_tested_at', date('Y-m-d H:i:s')]);
    } catch (PDOException $e) { /* persistence is best-effort */ }

    echo json_encode([
        'success' => true,
        'message' => "Test OTP sent successfully to {$masked}. Check the mailbox to confirm delivery.",
        'to_masked' => $masked,
    ]);
    exit;
}

http_response_code(400);
echo json_encode(['error' => 'Unknown action.']);
