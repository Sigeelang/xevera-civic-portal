<?php
/*
 * One-shot migration: no-fee penalty schedule for the violation system.
 *
 * - Adds 'Permanent Restriction' to violations.penalty_type
 * - Adds violations.penalty_start_at / violations.penalty_end_at
 * - Refreshes the default violation_penalty_config (no fines, 3-day
 *   reporting restriction for Major)
 *
 * CLI ONLY: php apply_penalty_schedule.php
 * Safe to run multiple times (every step checks first).
 */

if (php_sapi_name() !== 'cli') {
    http_response_code(403);
    echo json_encode(['error' => 'CLI only.']);
    exit;
}

require_once __DIR__ . '/../api/config/database.php';

$out = ['ok' => true, 'steps' => []];

function step(&$out, $name, $fn) {
    try {
        $out['steps'][$name] = $fn();
    } catch (Throwable $e) {
        $out['ok'] = false;
        $out['steps'][$name] = 'ERROR: ' . $e->getMessage();
    }
}

// 1. Extend the penalty_type enum
step($out, 'penalty_type_enum', function () use ($pdo) {
    $row = $pdo->query("SHOW COLUMNS FROM violations LIKE 'penalty_type'")->fetch();
    if (!$row) return 'column missing, skipped';
    if (stripos($row['Type'], 'Permanent Restriction') !== false) return 'already present';
    $pdo->exec("ALTER TABLE violations MODIFY penalty_type ENUM('Warning','Reporting Restriction','Fine','Short Suspension','Long Suspension','Indefinite Suspension','Permanent Restriction') DEFAULT NULL");
    return 'added Permanent Restriction';
});

// 2. Add schedule columns
step($out, 'penalty_start_at', function () use ($pdo) {
    $row = $pdo->query("SHOW COLUMNS FROM violations LIKE 'penalty_start_at'")->fetch();
    if ($row) return 'already present';
    $pdo->exec("ALTER TABLE violations ADD COLUMN penalty_start_at DATETIME DEFAULT NULL AFTER restriction_until");
    return 'added';
});

step($out, 'penalty_end_at', function () use ($pdo) {
    $row = $pdo->query("SHOW COLUMNS FROM violations LIKE 'penalty_end_at'")->fetch();
    if ($row) return 'already present';
    $pdo->exec("ALTER TABLE violations ADD COLUMN penalty_end_at DATETIME DEFAULT NULL AFTER penalty_start_at");
    return 'added';
});

// 3. Backfill existing confirmed rows: schedule from their violation date at 8AM
step($out, 'backfill', function () use ($pdo) {
    $hasStart = $pdo->query("SHOW COLUMNS FROM violations LIKE 'penalty_start_at'")->fetch();
    if (!$hasStart) return 'columns missing, skipped';
    $stmt = $pdo->query("SELECT id, created_at, suspension_days, penalty_type FROM violations WHERE status = 'Confirmed' AND penalty_start_at IS NULL");
    $rows = $stmt->fetchAll();
    $n = 0;
    $tz = new DateTimeZone('Asia/Manila');
    foreach ($rows as $r) {
        try {
            $created = new DateTime($r['created_at'], $tz);
        } catch (Throwable $e) {
            $created = new DateTime('now', $tz);
        }
        $start = clone $created;
        $start->setTime(8, 0, 0);
        $end = null;
        $days = $r['suspension_days'] !== null ? (int)$r['suspension_days'] : null;
        if ($r['penalty_type'] === 'Reporting Restriction' && $days === null) $days = 3;
        if ($days !== null && $days > 0) {
            $end = clone $start;
            $end->modify('+' . $days . ' days');
        }
        $u = $pdo->prepare("UPDATE violations SET penalty_start_at = ?, penalty_end_at = ? WHERE id = ?");
        $u->execute([$start->format('Y-m-d H:i:s'), $end ? $end->format('Y-m-d H:i:s') : null, $r['id']]);
        $n++;
    }
    return "backfilled $n rows";
});

// 4. Refresh default penalty config (no fines)
step($out, 'penalty_config', function () use ($pdo) {
    $value = '{"Minor":{"warning":true},"Major":{"restriction_days":3},"Serious":{"suspension_days":7},"Critical":{"suspension_days":30}}';
    $stmt = $pdo->prepare("INSERT INTO system_settings (`key`, `value`) VALUES ('violation_penalty_config', ?) ON DUPLICATE KEY UPDATE `value` = VALUES(`value`)");
    $stmt->execute([$value]);
    return 'updated';
});

echo json_encode($out, JSON_PRETTY_PRINT) . PHP_EOL;
exit($out['ok'] ? 0 : 1);
