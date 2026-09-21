<?php
/*
 * Shared no-fee penalty schedule.
 *
 * Every penalty/restriction starts at 8:00 AM (Asia/Manila). If the admin
 * approves after 8:00 AM, the effective date is the next calendar day
 * at 8:00 AM. No monetary amount is ever attached.
 */

function xevera_penalty_map() {
    return [
        'warning' => ['label' => 'Warning', 'days' => 0],
        'reporting_restriction' => ['label' => 'Reporting Restriction', 'days' => 3],
        'short_suspension' => ['label' => 'Short Suspension', 'days' => 7],
        'long_suspension' => ['label' => 'Long Suspension', 'days' => 30],
        'permanent_restriction' => ['label' => 'Permanent Restriction', 'days' => null],
    ];
}

/*
 * Resolve an explicit penalty_key (or fall back to the legacy
 * severity auto-map) into a concrete schedule.
 *
 * Returns ['penalty_type', 'days', 'start', 'end'] where start/end are
 * 'Y-m-d H:i:s' Asia/Manila datetimes (end is null for Warning and
 * Permanent Restriction).
 */
function xevera_penalty_schedule($penaltyKey = null, $severity = 'Minor', $penaltyConfig = []) {
    $map = xevera_penalty_map();

    if ($penaltyKey && isset($map[$penaltyKey])) {
        $label = $map[$penaltyKey]['label'];
        $days = $map[$penaltyKey]['days'];
    } else {
        // Legacy severity auto-assign (no fines).
        if ($severity === 'Critical') {
            $label = 'Long Suspension';
            $days = isset($penaltyConfig['suspension_days']) ? (int)$penaltyConfig['suspension_days'] : 30;
        } elseif ($severity === 'Serious') {
            $label = 'Short Suspension';
            $days = isset($penaltyConfig['suspension_days']) ? (int)$penaltyConfig['suspension_days'] : 7;
        } elseif ($severity === 'Major') {
            $label = 'Reporting Restriction';
            $days = isset($penaltyConfig['restriction_days']) ? (int)$penaltyConfig['restriction_days'] : 3;
        } else {
            $label = 'Warning';
            $days = 0;
        }
    }

    $tz = new DateTimeZone('Asia/Manila');
    $now = new DateTime('now', $tz);
    $start = clone $now;
    if ((int)$now->format('H') > 8 || ((int)$now->format('H') === 8 && (int)$now->format('i') > 0)) {
        $start->modify('+1 day');
    }
    $start->setTime(8, 0, 0);

    $end = null;
    if ($days !== null && (int)$days > 0) {
        $end = clone $start;
        $end->modify('+' . (int)$days . ' days');
    }

    return [
        'penalty_type' => $label,
        'days' => $days,
        'start' => $start->format('Y-m-d H:i:s'),
        'end' => $end ? $end->format('Y-m-d H:i:s') : null,
    ];
}
