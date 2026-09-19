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

echo json_encode([
    'violations' => $violations,
    'violation_count' => $violationCount,
]);
