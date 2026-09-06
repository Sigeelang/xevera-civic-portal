<?php
/**
 * Xevera Portal SMTP configuration.
 *
 * SECURITY:
 * All credentials come from backend/.env (or real environment variables).
 * There are NO hardcoded fallbacks - if the env vars are missing the
 * mailer fails closed (xevera_smtp_credentials() reports not-configured).
 *
 * SES Integration:
 * When XEVERA_SMTP_USE_SECRETS_MANAGER=1, credentials are loaded from
 * AWS Secrets Manager secret "xevera/ses/smtp". When disabled or if the
 * secret cannot be retrieved, falls back to backend/.env.
 *
 *   XEVERA_SMTP_HOST   e.g. ssl://smtp.gmail.com
 *   XEVERA_SMTP_PORT   e.g. 465
 *   XEVERA_SMTP_USER   your Gmail address
 *   XEVERA_SMTP_PASS   your 16-char Google App Password
 *   XEVERA_SMTP_FROM   sender address (usually same as user)
 */

require_once __DIR__ . '/env.php';

define('APP_NAME', getenv('APP_NAME') ?: 'Xevera Portal');

// Load SES credentials from Secrets Manager or fall back to .env
$useSecretsManager = getenv('XEVERA_SMTP_USE_SECRETS_MANAGER') === '1';

if ($useSecretsManager) {
    // Try to load SES credentials from AWS Secrets Manager
    $sesCredentials = xevera_secrets_manager_get_ses_credentials();
    if ($sesCredentials !== null && is_array($sesCredentials)) {
        define('MAIL_HOST', $sesCredentials['host'] ?? 'email-smtp.ap-southeast-2.amazonaws.com');
        define('MAIL_PORT', ($sesCredentials['port'] ?? 587) + 0);
        define('MAIL_USER', $sesCredentials['username'] ?? '');
        define('MAIL_PASS', $sesCredentials['password'] ?? '');
        define('MAIL_FROM', $sesCredentials['from_address'] ?? getenv('XEVERA_SMTP_FROM') ?: MAIL_USER);
        error_log('xevera_mail: Using SES credentials from Secrets Manager.');
    } else {
        // Secrets Manager explicitly enabled but could not retrieve secret.
        // Do NOT automatically fall back to Gmail .env credentials - that would
        // silently switch providers and make troubleshooting unpredictable.
        // Instead, set credentials that will cause SMTP send to fail,
        // so the email is saved to the local queue for admin review/retry.
        define('MAIL_HOST', 'email-smtp.unavailable.invalid');
        define('MAIL_PORT', 587);
        define('MAIL_USER', '');
        define('MAIL_PASS', '');
        define('MAIL_FROM', getenv('XEVERA_SMTP_FROM') ?: 'no-reply@invalid.invalid');
        error_log('xevera_mail: XEVERA_SMTP_USE_SECRETS_MANAGER=1 but SES secret retrieval failed.');
        error_log('xevera_mail: SMTP send will fail and email will be queued for admin review. No automatic Gmail fallback.');
    }
} else {
    // Use .env configuration (default behavior)
    define('MAIL_HOST', (string) getenv('XEVERA_SMTP_HOST'));
    define('MAIL_PORT', (int) getenv('XEVERA_SMTP_PORT'));
    define('MAIL_USER', (string) getenv('XEVERA_SMTP_USER'));
    define('MAIL_PASS', (string) getenv('XEVERA_SMTP_PASS'));
    define('MAIL_FROM', getenv('XEVERA_SMTP_FROM') ?: MAIL_USER);
}

/**
 * Retrieves SES credentials from AWS Secrets Manager secret "xevera/ses/smtp".
 * Returns associative array with host, port, username, password, from_address,
 * or false if the secret cannot be retrieved (e.g. SDK not available, network error).
 *
 * NOTE: The AWS SDK for PHP must be available (via Composer) and the EC2 instance
 * must have an IAM role allowing secretsmanager:GetSecretValue on xevera/ses/smtp,
 * or this function will return false and the mailer will fall back to .env.
 */
function xevera_secrets_manager_get_ses_credentials(): ?array {
    $secretName = 'xevera/ses/smtp';
    $region = 'ap-southeast-2';

    // Try to use AWS SDK for PHP if Composer autoload is available.
    // __DIR__ is backend/api/config, so backend/vendor is two levels up.
    $vendorPath = __DIR__ . '/../../vendor/autoload.php';
    if (file_exists($vendorPath)) {
        try {
            require_once $vendorPath;
            if (class_exists(Aws\Sdk::class)) {
                $Sdk = new Aws\Sdk([
                    'region' => $region,
                    'version' => 'latest',
                ]);
                $client = $Sdk->createClient('secretsmanager');
                $result = $client->getSecretValue(['SecretId' => $secretName]);
                if (isset($result['SecretString'])) {
                    $secretString = $result['SecretString'];
                    $secret = json_decode($secretString, true);
                    if (is_array($secret)) {
                        return [
                            'host' => $secret['host'] ?? 'email-smtp.ap-southeast-2.amazonaws.com',
                            'port' => $secret['port'] ?? 587,
                            'username' => $secret['username'] ?? '',
                            'password' => $secret['password'] ?? '',
                            'from_address' => $secret['from_address'] ?? '',
                        ];
                    }
                }
            }
        } catch (Throwable $e) {
            // SDK available but request failed - fall through
            error_log('xevera_mail: Secrets Manager lookup failed: ' . $e->getMessage());
        }
    }

    // Could not retrieve secret from AWS Secrets Manager
    return null;
}
