<?php
/**
 * Xevera mailer - Gmail SMTP via App Password.
 *
 * Setup:
 *  1. Enable 2-Step Verification on your Google account.
 *  2. Create an App Password: https://myaccount.google.com/apppasswords
 *  3. Provide credentials via environment variables (preferred)
 *     or in mail_config.php.
 *
 * All SMTP features (status, Test Connection, Send Test Email, OTP
 * delivery) share this single configuration source and service.
 */

require_once __DIR__ . '/mail_config.php';

/**
 * Normalizes and validates the configured SMTP credentials.
 * App Passwords may contain spaces - they are stripped safely.
 *
 * Returns [string user, string pass, string from, bool ok].
 */
function xevera_smtp_credentials(): array {
    $user = trim(MAIL_USER);
    $pass = preg_replace('/\s+/', '', MAIL_PASS);
    $from = trim(MAIL_FROM);

    $placeholders = [
        '',
        'put_your_app_password_here',
        'yourgmail@gmail.com',
        'your_password',
        'your-password',
        'change_me',
        'password',
    ];

    $ok = $user !== ''
        && $pass !== ''
        && $from !== ''
        && strpos($user, '@') !== false
        && !in_array(strtolower($user), $placeholders, true)
        && !in_array(strtolower($pass), $placeholders, true);

    return [$user, $pass, $from, $ok];
}

/**
 * Verifies the SMTP connection and authentication WITHOUT sending mail.
 * Returns [bool ok, string|null error].
 */
function xevera_smtp_test_connection(): array {
    [$user, $pass, , $ok] = xevera_smtp_credentials();

    if (!$ok) {
        return [false, 'SMTP credentials are not configured.'];
    }

    $host = MAIL_HOST;
    $port = MAIL_PORT;

    $socket = @fsockopen($host, $port, $errno, $errstr, 15);
    if (!$socket) {
        return [false, "Could not connect to {$host}:{$port}."];
    }
    stream_set_timeout($socket, 15);

    $read = function () use ($socket): string {
        $data = '';
        while (($line = fgets($socket, 515)) !== false) {
            $data .= $line;
            if (isset($line[3]) && $line[3] === ' ') break;
        }
        return $data;
    };
    $write = function (string $command) use ($socket): void {
        fwrite($socket, $command . "\r\n");
    };

    try {
        $greeting = $read();
        if ($greeting === '' || !preg_match('/^220\b/m', $greeting)) {
            fclose($socket);
            return [false, 'SMTP server did not return a valid greeting.'];
        }

        $write('EHLO localhost');
        if ($read() === '') {
            fclose($socket);
            return [false, 'SMTP EHLO command failed.'];
        }

        $write('AUTH LOGIN');
        if (!preg_match('/^334\b/m', $read())) {
            fclose($socket);
            return [false, 'SMTP authentication is not available on this server.'];
        }

        $write(base64_encode($user));
        if (!preg_match('/^334\b/m', $read())) {
            fclose($socket);
            return [false, 'SMTP username was rejected.'];
        }

        $write(base64_encode($pass));
        $authResponse = trim($read());
        fclose($socket);

        if (!preg_match('/^235\b/m', $authResponse)) {
            error_log('xevera_mail: SMTP test auth failed [' . xevera_smtp_failure_category($authResponse) . ']: ' . preg_replace('/\s+/', ' ', $authResponse));
            return [false, 'SMTP authentication failed. Check the Gmail address and App Password.'];
        }

        return [true, null];

    } catch (Throwable $e) {
        if (is_resource($socket)) fclose($socket);
        error_log('xevera_mail: SMTP test exception: ' . $e->getMessage());
        return [false, 'SMTP connection test failed.'];
    }
}

function xevera_smtp_send(string $to, string $subject, string $body): bool {
    [$user, $pass, $from, $credsOk] = xevera_smtp_credentials();
    $host = MAIL_HOST;
    $port = MAIL_PORT;

    if (!$credsOk) {
        error_log('xevera_mail: SMTP credentials are not configured');
        return false;
    }

    $socket = @fsockopen($host, $port, $errno, $errstr, 15);
    if (!$socket) {
        error_log("xevera_mail: connect failed [smtp.connect] ($errno) $errstr");
        return false;
    }
    stream_set_timeout($socket, 15);

    $read = function () use ($socket): string {
        $data = '';
        while (($line = fgets($socket, 515)) !== false) {
            $data .= $line;
            if (isset($line[3]) && $line[3] === ' ') break;
        }
        return $data;
    };
    $readAll = function (int $timeout = 5) use ($socket): string {
        $data = '';
        stream_set_timeout($socket, $timeout);
        $start = time();
        while ((time() - $start) < $timeout) {
            $line = @fgets($socket, 515);
            if ($line === false) break;
            $data .= $line;
            if (isset($line[3]) && $line[3] === ' ') break;
        }
        return $data;
    };
    $write = function (string $cmd) use ($socket): void {
        fwrite($socket, $cmd . "\r\n");
    };

    $read();                                   // 220 greeting
    $write('EHLO localhost');                  // say hello
    $read();
    $write('AUTH LOGIN');
    $read();
    $write(base64_encode($user));
    $read();
    $write(base64_encode($pass));
    $authResp = $read();
    if (strpos($authResp, '235') !== 0) {
        error_log('xevera_mail: auth failed [' . xevera_smtp_failure_category($authResp) . ']: ' . trim($authResp));
        fclose($socket);
        return false;
    }

    $safeSubject = '=?UTF-8?B?' . base64_encode('[' . APP_NAME . '] ' . $subject) . '?=';
    $headers = "From: " . APP_NAME . " <{$from}>\r\n"
             . "To: <{$to}>\r\n"
             . "Date: " . date('r') . "\r\n"
             . "Message-ID: <" . bin2hex(random_bytes(16)) . "@" . parse_url('https://' . ($_SERVER['HTTP_HOST'] ?? 'xevera-portal.duckdns.org'), PHP_URL_HOST) . ">\r\n"
             . "MIME-Version: 1.0\r\n"
             . "Content-type: text/plain; charset=UTF-8\r\n";

    $write("MAIL FROM:<{$from}>");
    $read();
    $write("RCPT TO:<{$to}>");
    $rcptResp = $read();
    if (strpos($rcptResp, '250') !== 0) {
        error_log('xevera_mail: rcpt rejected [' . xevera_smtp_failure_category($rcptResp) . ']: ' . trim($rcptResp));
        fclose($socket);
        return false;
    }
    $write('DATA');
    $dataStart = $read();
    if (strpos($dataStart, '354') !== 0) {
        error_log('xevera_mail: data not accepted [' . xevera_smtp_failure_category($dataStart) . ']: ' . trim($dataStart));
        fclose($socket);
        return false;
    }
    $body = str_replace("\r\n.", "\r\n..", $body);
    $write($headers . "\r\n" . $body . "\r\n.");
    $dataResp = $readAll(10);
    $ok = strpos($dataResp, '250') === 0;
    if (!$ok) error_log('xevera_mail: send failed [' . xevera_smtp_failure_category($dataResp) . ']: ' . trim($dataResp));
    if ($ok && preg_match('/\b(\d{10,15})\b/', $dataResp, $qm)) {
        // Gmail queue ID - the strongest possible server-side evidence the
        // message was accepted for processing. Useful for support and for
        // log correlation when the recipient claims they never received it.
        error_log('xevera_mail: gmail_queue_id=' . $qm[1] . ' recipient=' . $to);
    }

    $write('QUIT');
    fclose($socket);
    return $ok;
}

function xevera_mail(string $to, string $subject, string $body): bool {
    $attempts = 0;
    $maxAttempts = 2;
    $lastResult = false;
    while ($attempts < $maxAttempts) {
        $attempts++;
        $lastResult = xevera_smtp_send($to, $subject, $body);
        if ($lastResult) return true;
        if ($attempts < $maxAttempts) {
            error_log("xevera_mail: retrying after attempt $attempts");
            sleep(2);
        }
    }

    /*
     * SMTP delivery failed (Gmail daily limit, SES throttling, network
     * error, etc). Save the email to a local queue so it can be retried
     * later by xevera_mail_queue_retry() or the admin "Retry queue" UI.
     *
     * This means: even if the SMTP server is down or rate-limited,
     * the application does not lose the email. The user is told the
     * email was queued, not dropped on the floor.
     */
    $queued = xevera_mail_queue_save($to, $subject, $body);
    if ($queued) {
        error_log("xevera_mail: queued for retry to {$to}");
    } else {
        error_log("xevera_mail: queue write failed to {$to}");
    }
    return false;
}

function xevera_mail_queue_dir(): string {
    $dir = trim((string) (getenv('XEVERA_MAIL_QUEUE_DIR') ?: ''));
    if ($dir === '') {
        $dir = '/var/www/xevera/backend/storage/mail_queue';
    }
    return rtrim($dir, "/\\");
}

function xevera_mail_queue_save(string $to, string $subject, string $body): bool {
    $dir = xevera_mail_queue_dir();
    if (!is_dir($dir)) {
        @mkdir($dir, 0750, true);
    }
    if (!is_dir($dir)) return false;

    $payload = [
        'to' => $to,
        'subject' => $subject,
        'body' => $body,
        'created_at' => date('c'),
        'attempts' => 0,
        'last_error' => '',
    ];
    $name = date('Ymd-His') . '-' . bin2hex(random_bytes(4)) . '.json';
    $path = $dir . '/' . $name;
    $ok = @file_put_contents($path, json_encode($payload, JSON_UNESCAPED_SLASHES));
    if ($ok === false) return false;
    @chmod($path, 0640);
    return true;
}

function xevera_mail_queue_count(): int {
    $dir = xevera_mail_queue_dir();
    if (!is_dir($dir)) return 0;
    $i = 0;
    foreach (glob($dir . '/*.json') ?: [] as $f) $i++;
    return $i;
}

/**
 * Retry policy for the on-disk mail queue.
 *
 * Triage (never blind-resend): a queued item is DISCARDED (deleted, counted
 * separately, logged) instead of retried when it is older than
 * XEVERA_MAIL_QUEUE_MAX_AGE_HOURS (default 48) or has already failed
 * XEVERA_MAIL_QUEUE_MAX_ATTEMPTS (default 5) times. Rationale: OTP codes
 * expire in 5-10 minutes, so resending day-old OTP mail only confuses
 * recipients; persistently failing items need admin attention, not more
 * retries. Malformed payloads are likewise discarded, not retried.
 */
function xevera_mail_queue_retry(int $maxItems = 50): array {
    $dir = xevera_mail_queue_dir();
    if (!is_dir($dir)) return ['sent' => 0, 'failed' => 0, 'discarded' => 0, 'remaining' => 0];

    $maxAgeHours = (int) (getenv('XEVERA_MAIL_QUEUE_MAX_AGE_HOURS') ?: 48);
    $maxAttempts = (int) (getenv('XEVERA_MAIL_QUEUE_MAX_ATTEMPTS') ?: 5);

    $files = array_slice(array_values(array_filter(glob($dir . '/*.json') ?: [], 'is_file')), 0, $maxItems);
    $sent = 0;
    $failed = 0;
    $discarded = 0;
    foreach ($files as $f) {
        $raw = @file_get_contents($f);
        $payload = $raw === false ? null : json_decode($raw, true);
        if (!is_array($payload) || empty($payload['to']) || empty($payload['subject']) || !isset($payload['body'])) {
            @unlink($f);
            error_log('xevera_mail: queue item malformed, discarded: ' . basename($f));
            $discarded++;
            continue;
        }
        $attempts = (int) ($payload['attempts'] ?? 0);
        $createdAt = isset($payload['created_at']) ? strtotime((string) $payload['created_at']) : false;
        $ageHours = ($createdAt === false) ? 0 : (time() - $createdAt) / 3600;
        if ($attempts >= $maxAttempts || $ageHours > $maxAgeHours) {
            @unlink($f);
            error_log('xevera_mail: queue item discarded (stale/failing): to=' . $payload['to']
                . ' subject=' . $payload['subject']
                . ' attempts=' . $attempts
                . ' age_h=' . round($ageHours, 1));
            $discarded++;
            continue;
        }
        $ok = xevera_smtp_send($payload['to'], $payload['subject'], $payload['body']);
        if ($ok) {
            @unlink($f);
            $sent++;
        } else {
            $payload['attempts'] = $attempts + 1;
            $payload['last_error'] = 'smtp send failed at ' . date('c');
            @file_put_contents($f, json_encode($payload, JSON_UNESCAPED_SLASHES));
            $failed++;
        }
    }
    $remaining = count(array_filter(glob($dir . '/*.json') ?: [], 'is_file'));
    return ['sent' => $sent, 'failed' => $failed, 'discarded' => $discarded, 'remaining' => $remaining];
}

function xevera_maybe_notify(string $to, string $subject, string $body): void {
    if ($to !== '' && filter_var($to, FILTER_VALIDATE_EMAIL)) {
        xevera_mail($to, $subject, $body);
    }
}

/**
 * Classifies an SMTP failure response so the application log carries a
 * single short tag (e.g. "smtp.auth" or "smtp.recipient") instead of
 * the full multi-line response. The full text is still preserved in the
 * previous error_log call, so this is purely an extra breadcrumb.
 */
function xevera_smtp_failure_category(string $response): string {
    $code = (int) substr(ltrim($response), 0, 3);
    if ($code >= 400 && $code < 500) return 'smtp.protocol';
    if ($code === 421) return 'smtp.temporarily_unavailable';
    if ($code === 450 || $code === 451) return 'smtp.mailbox_unavailable';
    if ($code === 452) return 'smtp.storage_full';
    if ($code === 454) return 'smtp.tls_required';
    if ($code === 501 || $code === 502 || $code === 503 || $code === 504 || $code === 521) return 'smtp.command_rejected';
    if ($code === 530 || $code === 534 || $code === 535 || $code === 538) return 'smtp.auth';
    if ($code === 550) return 'smtp.recipient_rejected';
    if ($code === 551 || $code === 552 || $code === 553) return 'smtp.address_rejected';
    if ($code === 554) return 'smtp.transaction_failed';
    if ($code >= 500) return 'smtp.server_error';
    if ($code >= 200) return 'smtp.unexpected_success';
    return 'smtp.unknown';
}
