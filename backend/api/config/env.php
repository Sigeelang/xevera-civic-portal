<?php
/**
 * Minimal .env loader for the Xevera backend.
 *
 * Loads backend/.env (never committed) into the process environment so
 * secrets stay out of source control. Real environment variables always
 * win over .env values.
 */

if (defined('XEVERA_ENV_LOADED')) {
    return;
}

function xevera_load_env(): void
{
    $file = dirname(__DIR__, 2) . DIRECTORY_SEPARATOR . '.env'; // backend/.env

    if (is_file($file)) {
        $lines = file($file, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) ?: [];
        foreach ($lines as $line) {
            $line = trim($line);
            if ($line === '' || $line[0] === '#' || !str_contains($line, '=')) {
                continue;
            }
            $pos = strpos($line, '=');
            $key = trim(substr($line, 0, $pos));
            $val = trim(substr($line, $pos + 1));

            $len = strlen($val);
            if ($len >= 2 && (($val[0] === '"' && $val[$len - 1] === '"') || ($val[0] === "'" && $val[$len - 1] === "'"))) {
                $val = substr($val, 1, -1);
            }

            if ($key === '' || getenv($key) !== false) {
                continue;
            }
            putenv("$key=$val");
            $_ENV[$key] = $val;
            $_SERVER[$key] = $val;
        }
    }

    define('XEVERA_ENV_LOADED', true);
}

xevera_load_env();

/*
 * Application timezone. The portal serves Philippine local time (PHST,
 * UTC+8) - matching the MySQL server timezone so PHP date()/MySQL NOW()
 * agree on "today" and stored timestamps display correctly.
 */
date_default_timezone_set('Asia/Manila');
