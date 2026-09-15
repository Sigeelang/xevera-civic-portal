<?php
/**
 * AWS Secrets Manager bootstrap.
 *
 * Loads application secrets from AWS Secrets Manager into the process
 * environment BEFORE backend/.env is parsed, so AWS values become the
 * source of truth (the .env loader skips keys already present).
 *
 * Security / resilience notes:
 *   - Uses the EC2 instance role - no credentials are stored in code.
 *   - Fails OPEN to backend/.env: any error (no SDK, no permission,
 *     network) simply leaves the environment untouched, so the app
 *     always boots. Secrets are never logged.
 *   - The fetched secret is cached to a local file for a short TTL so
 *     we do not call AWS on every request.
 *   - Set XEVERA_USE_SECRETS_MANAGER=0 to disable (e.g. local dev).
 */

if (defined('XEVERA_SECRETS_BOOTSTRAPPED')) {
    return;
}
define('XEVERA_SECRETS_BOOTSTRAPPED', true);

/**
 * Secret key => environment variable name.
 * (Keys not listed here are ignored.)
 */
const XEVERA_SECRET_ENV_MAP = [
    'APP_KEY'             => 'APP_KEY',
    'DB_HOST'             => 'DB_HOST',
    'DB_NAME'             => 'DB_NAME',
    'DB_USER'             => 'DB_USER',
    'DB_PASS'             => 'DB_PASS',
    'MAIL_FROM'           => 'MAIL_FROM',
    'MAIL_PROVIDER'       => 'MAIL_PROVIDER',
    'CORS_ALLOW_ORIGINS'  => 'CORS_ALLOW_ORIGINS',
    'CRON_SECRET'         => 'XEVERA_MAINTENANCE_CRON_SECRET',
];

function xevera_secrets_bootstrap(): void
{
    // Explicit opt-out (local development, CI).
    if (getenv('XEVERA_USE_SECRETS_MANAGER') === '0') {
        return;
    }

    $secretId = getenv('XEVERA_SECRET_ID') ?: 'xevera/app';
    $backendDir = dirname(__DIR__, 2);            // .../backend
    $autoload = $backendDir . '/vendor/autoload.php';
    /*
     * Cache lives in storage/cache/, which is labelled httpd_sys_rw_content_t
     * so the web process is permitted to write it (storage/ itself is
     * httpd_sys_content_t and read-only for httpd under SELinux).
     */
    $cacheFile = $backendDir . '/storage/cache/.secrets_cache.json';
    $ttl = 300;                                    // seconds

    $data = null;

    // 1) Warm cache?
    if (is_file($cacheFile)) {
        $age = time() - (int) @filemtime($cacheFile);
        if ($age >= 0 && $age < $ttl) {
            $cached = json_decode((string) @file_get_contents($cacheFile), true);
            if (is_array($cached)) {
                $data = $cached;
            }
        }
    }

    // 2) Fetch from AWS (only on a cache miss, and only when the SDK exists).
    if ($data === null) {
        if (!is_file($autoload)) {
            return; // No SDK (local dev) - fall back to .env silently.
        }
        try {
            require_once $autoload;
            $region = getenv('AWS_REGION') ?: getenv('AWS_SES_REGION') ?: 'ap-southeast-2';
            $sdk = new Aws\Sdk(['region' => $region, 'version' => 'latest']);
            $client = $sdk->createSecretsManager();
            $res = $client->getSecretValue(['SecretId' => $secretId]);
            $json = $res['SecretString'] ?? null;
            if (is_string($json) && $json !== '') {
                $decoded = json_decode($json, true);
                if (is_array($decoded)) {
                    $data = $decoded;
                    $dir = dirname($cacheFile);
                    if (is_dir($dir) && is_writable($dir)) {
                        @file_put_contents($cacheFile, json_encode($decoded), LOCK_EX);
                        @chmod($cacheFile, 0640);
                    }
                }
            }
        } catch (Throwable $e) {
            // Never log secret material; a failure is non-fatal.
            error_log('xevera_secrets: fetch failed (' . $e->getMessage() . ') - falling back to .env');
            return;
        }
    }

    if (!is_array($data)) {
        return;
    }

    // 3) Publish into the process environment. Real env always wins.
    foreach (XEVERA_SECRET_ENV_MAP as $secretKey => $envKey) {
        if (!array_key_exists($secretKey, $data)) {
            continue;
        }
        $value = $data[$secretKey];
        if (!is_string($value) || $value === '') {
            continue;
        }
        if (getenv($envKey) !== false) {
            continue;
        }
        putenv("$envKey=$value");
        $_ENV[$envKey] = $value;
        $_SERVER[$envKey] = $value;
    }
}
