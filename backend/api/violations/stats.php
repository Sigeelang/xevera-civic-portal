<?php
header('Content-Type: application/json');
require_once __DIR__ . '/../config/cors.php';
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../middleware/auth.php';

$user = requireRole(['Admin', 'Super Admin']);

$stats = [];

// Total violations
$r = $pdo->query("SELECT COUNT(*) FROM violations")->fetchColumn();
$stats['total'] = (int)$r;

// By status
$stmt = $pdo->query("SELECT status, COUNT(*) AS cnt FROM violations GROUP BY status");
$stats['by_status'] = [];
while ($row = $stmt->fetch()) { $stats['by_status'][$row['status']] = (int)$row['cnt']; }

// By severity
$stmt = $pdo->query("SELECT severity, COUNT(*) AS cnt FROM violations GROUP BY severity");
$stats['by_severity'] = [];
while ($row = $stmt->fetch()) { $stats['by_severity'][$row['severity']] = (int)$row['cnt']; }

// By type
$stmt = $pdo->query("SELECT violation_type, COUNT(*) AS cnt FROM violations GROUP BY violation_type");
$stats['by_type'] = [];
while ($row = $stmt->fetch()) { $stats['by_type'][$row['violation_type']] = (int)$row['cnt']; }

// Pending reviews
$stats['pending_review'] = (int)$pdo->query("SELECT COUNT(*) FROM violations WHERE status = 'Pending Review'")->fetchColumn();

// Appealed
$stats['appealed'] = (int)$pdo->query("SELECT COUNT(*) FROM violations WHERE status = 'Appealed'")->fetchColumn();

// Total fines issued
$r = $pdo->query("SELECT COALESCE(SUM(penalty_amount), 0) FROM violations WHERE penalty_type = 'Fine' AND status IN ('Confirmed','Resolved')")->fetchColumn();
$stats['total_fines'] = (float)$r;

// Currently suspended residents
$stats['suspended_residents'] = (int)$pdo->query("SELECT COUNT(*) FROM users WHERE status = 'Inactive' AND violation_count > 0")->fetchColumn();

echo json_encode($stats);
