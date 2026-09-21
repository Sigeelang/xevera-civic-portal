<?php
header('Content-Type: application/json');
require_once __DIR__ . '/../config/cors.php';

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }
if ($_SERVER['REQUEST_METHOD'] !== 'GET') { http_response_code(405); echo json_encode(['error' => 'Method not allowed']); exit; }

require_once __DIR__ . '/../middleware/auth.php';
requirePermission('attendance', ['Admin', 'Super Admin']);

require_once __DIR__ . '/../config/database.php';

$today = date('Y-m-d');

$counts = [
    'total_staff' => 0,
    'present' => 0,
    'missing_time_out' => 0,
    'pending_time_in' => 0,
    'pending_time_out' => 0,
    'completed' => 0,
    'pending_corrections' => 0,
];

$stmt = $pdo->prepare("SELECT COUNT(*) FROM users WHERE role IN ('Staff', 'Admin', 'Super Admin') AND status = 'Active'");
$counts['total_staff'] = (int)$stmt->fetchColumn();

$stmt = $pdo->prepare("
    SELECT
        SUM(time_in IS NOT NULL AND time_out IS NOT NULL) AS present,
        SUM(time_in IS NOT NULL AND time_out IS NULL) AS missing_time_out,
        SUM(time_in_status = 'Pending') AS pending_time_in,
        SUM(time_out_status = 'Pending') AS pending_time_out,
        SUM(time_in_status = 'Approved' AND time_out_status = 'Approved') AS completed
    FROM attendance
    WHERE attendance_date = ?
");
$stmt->execute([$today]);
$row = $stmt->fetch();
if ($row) {
    $counts['present'] = (int)$row['present'];
    $counts['missing_time_out'] = (int)$row['missing_time_out'];
    $counts['pending_time_in'] = (int)$row['pending_time_in'];
    $counts['pending_time_out'] = (int)$row['pending_time_out'];
    $counts['completed'] = (int)$row['completed'];
}

$stmt = $pdo->prepare("SELECT COUNT(*) FROM attendance_corrections WHERE status = 'Pending'");
$counts['pending_corrections'] = (int)$stmt->fetchColumn();

echo json_encode(['date' => $today, 'counts' => $counts]);