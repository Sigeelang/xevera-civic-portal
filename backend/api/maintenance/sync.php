<?php
header('Content-Type: application/json');
require_once __DIR__ . '/../config/cors.php';

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

require_once __DIR__ . '/../config/database.php';

/*
 * Cron authentication: this endpoint flips maintenance mode (a state
 * change), so it must not be freely callable. Callers prove they are the
 * scheduler with a shared secret configured as XEVERA_MAINTENANCE_CRON_SECRET
 * in backend/.env (or real environment), sent either as ?secret= or via the
 * X-Xevera-Cron-Secret header. Compared with hash_equals (no timing leak).
 * Fail closed: missing/unset secret or mismatch -> 403, nothing runs.
 */
$expectedCronSecret = (string) (getenv('XEVERA_MAINTENANCE_CRON_SECRET') ?: '');
$providedCronSecret = (string) ($_GET['secret'] ?? $_SERVER['HTTP_X_XEVERA_CRON_SECRET'] ?? '');
if ($expectedCronSecret === '' || !hash_equals($expectedCronSecret, $providedCronSecret)) {
    error_log('xevera_maintenance: sync denied (bad or missing cron secret) from ' . ($_SERVER['REMOTE_ADDR'] ?? '?'));
    http_response_code(403);
    echo json_encode(['error' => 'Forbidden.']);
    exit;
}

function getModeValue($pdo) {
    $st = $pdo->query("SELECT `value` FROM system_settings WHERE `key` = 'maintenance_mode'");
    $row = $st->fetch();
    return $row ? ($row['value'] === '1') : false;
}

function setModeValue($pdo, $on) {
    $st = $pdo->prepare('INSERT INTO system_settings (`key`, `value`) VALUES (?, ?) ON DUPLICATE KEY UPDATE `value` = VALUES(`value`)');
    $st->execute(['maintenance_mode', $on ? '1' : '0']);
    $st2 = $pdo->prepare('INSERT INTO system_settings (`key`, `value`) VALUES (?, ?) ON DUPLICATE KEY UPDATE `value` = VALUES(`value`)');
    $st2->execute(['maintenance_enabled_by', $on ? 'schedule' : 'manual_off']);
}

// Player NOTE: run comparisons entirely in MySQL so PHP/MySQL timezone drift can't break auto-run.
$stmt = $pdo->prepare(
    "SELECT e.* FROM maintenance_events e
     WHERE e.type = 'scheduled'
       AND e.status IN ('scheduled', 'running')
       AND e.start_at IS NOT NULL AND e.end_at IS NOT NULL
       AND e.start_at <= NOW() AND e.end_at > NOW()
     ORDER BY e.start_at ASC LIMIT 1"
);
$stmt->execute();
$activeWindow = $stmt->fetch();

$mode = getModeValue($pdo);
$changed = false;

if ($activeWindow && !$mode) {
    setModeValue($pdo, true);
    $pdo->prepare("UPDATE maintenance_events SET status = 'running' WHERE id = ?")->execute([$activeWindow['id']]);
    $changed = true;
}

// Expired scheduled windows (ended before now) -> complete them, then gate off only if enabled by a schedule.
$stmt = $pdo->prepare(
    "SELECT e.id FROM maintenance_events e
     WHERE e.type = 'scheduled'
       AND e.status IN ('scheduled', 'running')
       AND e.end_at IS NOT NULL AND e.end_at <= NOW()
     ORDER BY e.end_at ASC"
);
$stmt->execute();
$expired = $stmt->fetchAll();

if (count($expired) > 0) {
    $st = $pdo->prepare("UPDATE maintenance_events SET status = 'completed' WHERE id = ?");
    foreach ($expired as $e) { $st->execute([$e['id']]); }

    // Any window still active after the cleanup?
    $st = $pdo->prepare(
        "SELECT e.id FROM maintenance_events e
         WHERE e.type = 'scheduled'
           AND e.status IN ('scheduled', 'running')
           AND e.start_at IS NOT NULL AND e.end_at IS NOT NULL
           AND e.start_at <= NOW() AND e.end_at > NOW() LIMIT 1"
    );
    $stillActive = $st->fetch();

    if (!$stillActive && $mode) {
        $st = $pdo->prepare("SELECT `value` FROM system_settings WHERE `key` = 'maintenance_enabled_by'");
        $st->execute();
        $enabledBy = $st->fetchColumn();
        if ($enabledBy === 'schedule') {
            setModeValue($pdo, false);
            $changed = true;
        }
    }
}

echo json_encode([
    'maintenance_mode' => getModeValue($pdo) ? 1 : 0,
    'active_window' => $activeWindow ? [
        'id' => (int)$activeWindow['id'],
        'reason' => $activeWindow['reason'],
    ] : null,
    'changed' => $changed,
    'checked_at' => $pdo->query('SELECT NOW()')->fetchColumn(),
]);