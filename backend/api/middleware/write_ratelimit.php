<?php
/**
 * Write-endpoint rate limiting.
 *
 * One-line per endpoint: `requireWriteRateLimit($pdo, 'reports.create')`.
 * The limits are defined in one place below so they can be tuned
 * centrally. Each entry is `max_requests` per `window_seconds`.
 *
 * The implementation reuses `rate_limits` table (from schema.sql)
 * via the existing `checkRateLimit()` helper. A pre-request DELETE
 * prunes old rows so the table doesn't grow unbounded.
 *
 * If a row is missing from this table the request is allowed (open
 * by default) so adding a new endpoint never blocks itself.
 */
require_once __DIR__ . '/ratelimit.php';

function xevera_write_rate_limit(PDO $pdo, string $endpoint, ?int $overrideMax = null, ?int $overrideWindow = null): void {
    $table = XEVERA_WRITE_RATE_LIMITS[$endpoint] ?? null;
    if ($table === null) {
        // No policy registered for this endpoint -> allow (fail-open).
        return;
    }
    $max    = $overrideMax    ?? $table['max'];
    $window = $overrideWindow ?? $table['window'];
    checkRateLimit($pdo, $max, $window, $endpoint);
}

/**
 * Central write-rate-limit table.
 *
 * Conservative defaults tuned to the existing public flow. Adjust per
 * endpoint as needed; entries can also be overridden at the call site
 * via `requireWriteRateLimit($pdo, 'reports.create', max: 5)`.
 *
 * Window is in seconds.
 */
const XEVERA_WRITE_RATE_LIMITS = [
    // Reports (resident + staff)
    'reports.create'   => ['max' => 10,  'window' => 3600],
    'reports.update'   => ['max' => 30,  'window' => 3600],
    'reports.comment'  => ['max' => 30,  'window' => 3600],
    'reports.like'     => ['max' => 60,  'window' => 3600],
    'reports.follow'   => ['max' => 60,  'window' => 3600],

    // Direct messages
    'messages.send'    => ['max' => 30,  'window' => 3600],

    // Contact + feedback
    'contact.create'   => ['max' => 5,   'window' => 3600],
    'contact.reply'    => ['max' => 30,  'window' => 3600],
    'contact.update'   => ['max' => 30,  'window' => 3600],
    'contact.delete'   => ['max' => 30,  'window' => 3600],
    'feedback.submit'  => ['max' => 5,   'window' => 3600],

    // Notifications
    'notifications.mark_read' => ['max' => 120, 'window' => 3600],
    'notifications.delete'    => ['max' => 60,  'window' => 3600],

    // Announcements (Admin / Super Admin)
    'announcements.create' => ['max' => 20,  'window' => 3600],
    'announcements.update' => ['max' => 30,  'window' => 3600],
    'announcements.delete' => ['max' => 30,  'window' => 3600],

    // Service requests + follow-ups + tasks
    'service_requests.create' => ['max' => 10, 'window' => 3600],
    'service_requests.update' => ['max' => 30, 'window' => 3600],
    'service_requests.delete' => ['max' => 30, 'window' => 3600],
    'followups.create'        => ['max' => 30, 'window' => 3600],
    'followups.update'        => ['max' => 30, 'window' => 3600],
    'followups.delete'        => ['max' => 30, 'window' => 3600],
    'tasks.create'            => ['max' => 30, 'window' => 3600],
    'tasks.update'            => ['max' => 30, 'window' => 3600],
    'tasks.delete'            => ['max' => 30, 'window' => 3600],

    // Maintenance toggle + delete
    'maintenance.toggle' => ['max' => 30, 'window' => 3600],
    'maintenance.delete' => ['max' => 30, 'window' => 3600],

    // Residents (Admin)
    'residents.create' => ['max' => 30, 'window' => 3600],
    'residents.delete' => ['max' => 30, 'window' => 3600],
    'residents.toggle' => ['max' => 30, 'window' => 3600],

    // Users (Super Admin)
    'users.create' => ['max' => 10, 'window' => 3600],
    'users.update' => ['max' => 30, 'window' => 3600],
    'users.delete' => ['max' => 10, 'window' => 3600],
    'users.toggle' => ['max' => 30, 'window' => 3600],

    // Profile (self)
    'profile.update' => ['max' => 30, 'window' => 3600],
    'profile.delete' => ['max' => 5,  'window' => 3600],

    // SMTP diagnostics (Super Admin only) - used during credential
    // rotation. Allow 6/hr so the operator can run multiple retries
    // without hitting the limit, but block runaway abuse.
    'smtp.test' => ['max' => 6, 'window' => 3600],
];
