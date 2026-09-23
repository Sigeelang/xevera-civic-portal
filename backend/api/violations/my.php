<?php
header('Content-Type: application/json');
require_once __DIR__ . '/../config/cors.php';
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../middleware/auth.php';

$user = requireRole(['Resident']);
$userId = (int)$user['user_id'];

$stmt = $pdo->prepare("
    SELECT v.*, r.ref_id AS report_ref_id, ib.name AS issued_by_name
    FROM violations v
    LEFT JOIN reports r ON v.report_id = r.id
    LEFT JOIN users ib ON v.issued_by = ib.id
    WHERE v.resident_id = ?
    ORDER BY v.created_at DESC
");
$stmt->execute([$userId]);
$violations = $stmt->fetchAll();

// Get violation count
$countStmt = $pdo->prepare("SELECT violation_count FROM users WHERE id = ?");
$countStmt->execute([$userId]);
$violationCount = (int)$countStmt->fetchColumn();

// Active reporting restriction summary (drives the resident submit block
// and dashboard banner). Expired penalties and warnings are excluded.
$activeRestriction = null;
try {
    $hasSchedCols = true;
    try {
        $pdo->query("SELECT penalty_start_at FROM violations LIMIT 1");
    } catch (Throwable $e) {
        $hasSchedCols = false;
    }
    $endExpr = $hasSchedCols
        ? 'COALESCE(v.penalty_end_at, v.restriction_until)'
        : 'v.restriction_until';
    $startExpr = $hasSchedCols ? 'v.penalty_start_at' : 'NULL';
    $arStmt = $pdo->prepare(
        "SELECT v.id AS violation_id, v.penalty_type, v.violation_type, v.description, $startExpr AS penalty_start, $endExpr AS penalty_until
         FROM violations v
         WHERE v.resident_id = ? AND v.status IN ('Confirmed','Appealed')
           AND v.penalty_type IN ('Reporting Restriction','Permanent Restriction','Indefinite Suspension')
           AND ($endExpr IS NULL OR $endExpr > NOW())
         ORDER BY v.created_at DESC LIMIT 1"
    );
    $arStmt->execute([$userId]);
    $row = $arStmt->fetch();
    if ($row) {
        $activeRestriction = [
            'violation_id' => (int)$row['violation_id'],
            'penalty_type' => $row['penalty_type'],
            'violation_type' => $row['violation_type'] ?? null,
            'reason' => $row['description'] ?? null,
            'penalty_start' => $row['penalty_start'] ?? null,
            'penalty_until' => $row['penalty_until'] ?? null,
        ];
    }
} catch (Throwable $e) { /* no restriction info: frontend hides the banner */ }

echo json_encode([
    'violations' => $violations,
    'violation_count' => $violationCount,
    'active_restriction' => $activeRestriction,
]);
