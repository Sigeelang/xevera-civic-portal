<?php
header('Content-Type: application/json');
require_once __DIR__ . '/../config/cors.php';

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }

require_once __DIR__ . '/../config/database.php';

$report_id = (int)($_GET['report_id'] ?? 0);
if (!$report_id) { echo json_encode([]); exit; }

$stmt = $pdo->prepare("SELECT f.*, u.name AS resident_name FROM feedback f LEFT JOIN users u ON f.resident_id = u.id WHERE f.report_id = ? ORDER BY f.created_at DESC");
$stmt->execute([$report_id]);
echo json_encode($stmt->fetchAll());
