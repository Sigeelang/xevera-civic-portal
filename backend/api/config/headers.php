<?php
/**
 * Central security headers.
 *
 * Included from cors.php so every API endpoint emits the same set of
 * protective response headers. CSP is intentionally a safe default
 * (default-src 'self'); tighten per a real CSP scan before production.
 *
 * Notes:
 *   - Strict-Transport-Security is gated on TLS. CloudFront in front
 *     of the AWS deployment will terminate HTTPS, so HSTS is safe to
 *     emit. For plain-HTTP local dev, HSTS is harmless (browsers only
 *     honor HSTS over HTTPS), but it can be turned off via an env flag
 *     if it ever causes trouble.
 */

header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');
header('Referrer-Policy: strict-origin-when-cross-origin');
header('Permissions-Policy: geolocation=(), microphone=(), camera=(), payment=()');
header('Cross-Origin-Opener-Policy: same-origin');
header('Content-Security-Policy: ' .
    "default-src 'self'; " .
    "img-src 'self' data: https:; " .
    "style-src 'self' 'unsafe-inline'; " .
    "script-src 'self'; " .
    "connect-src 'self' https:; " .
    "frame-ancestors 'none'; " .
    "base-uri 'self'; " .
    "form-action 'self'"
);

if ((getenv('XEVERA_ENABLE_HSTS') ?: '1') === '1') {
    header('Strict-Transport-Security: max-age=63072000; includeSubDomains');
}
