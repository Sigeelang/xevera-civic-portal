<?php
/**
 * Authoritative attendance state machine shared by attendance endpoints.
 *   NOT_TIMED_IN -> PENDING_TIME_IN -> TIMED_IN -> PENDING_TIME_OUT -> TIMED_OUT
 * Rejections: PENDING_TIME_IN -> NOT_TIMED_IN, PENDING_TIME_OUT -> TIMED_IN.
 */
function attendance_state(array $r): string {
    $tin = $r['time_in_status'] ?? null;
    $tout = $r['time_out_status'] ?? null;
    if (empty($r['time_in']) || $tin === null || $tin === 'Rejected') return 'NOT_TIMED_IN';
    if ($tin === 'Pending') return 'PENDING_TIME_IN';
    if (empty($r['time_out']) || $tout === 'Rejected') return 'TIMED_IN';
    if ($tout === 'Pending') return 'PENDING_TIME_OUT';
    return 'TIMED_OUT';
}

function attendance_status_label(string $state): string {
    switch ($state) {
        case 'PENDING_TIME_IN':
            return 'Pending Time In';
        case 'PENDING_TIME_OUT':
            return 'Pending Time Out';
        case 'TIMED_IN':
            return 'Present';
        case 'TIMED_OUT':
            return 'Completed';
        default:
            return 'Not Started';
    }
}

function attendance_time_label(?string $dt): ?string {
    return $dt ? date('g:i A', strtotime($dt)) : null;
}

/**
 * Compute total (minutes + label) only when BOTH official timestamps are approved.
 */
function attendance_total(?string $timeIn, ?string $timeOut): array {
    if (!$timeIn || !$timeOut) return ['minutes' => null, 'label' => null];
    $tIn = new DateTime($timeIn);
    $tOut = new DateTime($timeOut);
    $d = $tIn->diff($tOut);
    $minutes = $d->days * 1440 + $d->h * 60 + $d->i;
    $label = ($d->h + $d->days * 24) . 'h ' . $d->i . 'm';
    return ['minutes' => $minutes, 'label' => $label];
}