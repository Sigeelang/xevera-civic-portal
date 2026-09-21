<?php
header('Content-Type: application/json');
require_once __DIR__ . '/../config/cors.php';
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../middleware/auth.php';

$user = requirePermission('violations', ['Admin', 'Super Admin']);
$id = (int)($_GET['id'] ?? 0);
if (!$id) { http_response_code(400); echo json_encode(['error' => 'Violation ID required.']); exit; }

$stmt = $pdo->prepare("
    SELECT v.*, u.name AS resident_name, u.email AS resident_email, u.violation_count,
           ib.name AS issued_by_name, rb.name AS appeal_reviewed_by_name,
           r.ref_id AS report_ref_id, r.description AS report_description, r.category AS report_category
    FROM violations v
    JOIN users u ON v.resident_id = u.id
    LEFT JOIN users ib ON v.issued_by = ib.id
    LEFT JOIN users rb ON v.appeal_reviewed_by = rb.id
    LEFT JOIN reports r ON v.report_id = r.id
    WHERE v.id = ?
");
$stmt->execute([$id]);
$violation = $stmt->fetch();
if (!$violation) { http_response_code(404); echo json_encode(['error' => 'Violation not found.']); exit; }

$histStmt = $pdo->prepare("SELECT vh.*, h.name AS acted_by_name FROM violation_history vh LEFT JOIN users h ON vh.acted_by = h.id WHERE vh.violation_id = ? ORDER BY vh.created_at DESC");
$histStmt->execute([$id]);
$history = $histStmt->fetchAll();

echo json_encode(array_merge($violation, ['history' => $history]));
