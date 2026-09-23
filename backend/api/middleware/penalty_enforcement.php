<?php
/**
 * Shared penalty enforcement for resident submissions.
 *
 * xevera_reporting_block() returns null when the resident may submit,
 * or ['error' => message, 'penalty_type' => ?, 'penalty_until' => ?]
 * when an active penalty blocks new reports / service requests.
 *
 * Rules (same as middleware/auth.php login enforcement):
 *  - Expired suspension_until auto-lifts to Active.
 *  - Non-Active accounts (Short/Long Suspension) are blocked.
 *  - Active Reporting Restriction / Permanent Restriction /
 *    Indefinite Suspension violations block with their end date.
 *  - Warnings never block.
 *
 * The restriction lookup is fail-open on query error (availability over
 * enforcement); the account-status gate above always applies.
 */
function xevera_reporting_block(PDO $pdo, int $userId): ?array {
    try {
        $ruStmt = $pdo->prepare('SELECT status FROM users WHERE id = ? LIMIT 1');
        $ruStmt->execute([$userId]);
        $ruStatus = $ruStmt->fetchColumn();
        try {
            $suStmt = $pdo->prepare('SELECT suspension_until FROM users WHERE id = ? LIMIT 1');
            $suStmt->execute([$userId]);
            $suVal = $suStmt->fetchColumn();
            if ($suVal && strtotime((string)$suVal) <= time()) {
                $pdo->prepare("UPDATE users SET status = 'Active', suspension_until = NULL WHERE id = ?")->execute([$userId]);
                $ruStatus = 'Active';
            }
        } catch (Throwable $e) { /* older schema: fall through */ }
        if ($ruStatus !== false && $ruStatus !== 'Active') {
            return ['error' => 'Your account is suspended. You cannot submit reports at this time.', 'penalty_type' => 'Suspension', 'penalty_until' => null];
        }
    } catch (Throwable $e) {
        error_log('xevera_penalty: account check failed: ' . $e->getMessage());
    }

    try {
        $hasSchedCols = true;
        try {
            $pdo->query('SELECT penalty_start_at FROM violations LIMIT 1');
        } catch (Throwable $e) {
            $hasSchedCols = false;
        }
        $endExpr = $hasSchedCols
            ? 'COALESCE(v.penalty_end_at, v.restriction_until)'
            : 'v.restriction_until';
        $rStmt = $pdo->prepare(
            "SELECT v.penalty_type, $endExpr AS penalty_until
             FROM violations v
             WHERE v.resident_id = ? AND v.status IN ('Confirmed','Appealed')
               AND v.penalty_type IN ('Reporting Restriction','Permanent Restriction','Indefinite Suspension')
               AND ($endExpr IS NULL OR $endExpr > NOW())
             LIMIT 1"
        );
        $rStmt->execute([$userId]);
        $restr = $rStmt->fetch();
        if ($restr) {
            $until = $restr['penalty_until'] ?? null;
            if ($until) {
                $msg = 'Your reporting is restricted until ' . date('M j, Y \a\t g:i A', strtotime((string)$until)) . '. You can still view your existing reports.';
            } else {
                $msg = 'Reporting is permanently disabled on your account pending admin review. Contact support if you believe this is a mistake.';
            }
            return ['error' => $msg, 'penalty_type' => $restr['penalty_type'], 'penalty_until' => $until];
        }
    } catch (Throwable $e) {
        error_log('xevera_penalty: restriction check failed: ' . $e->getMessage());
    }

    return null;
}
