<?php
header('Content-Type: text/csv; charset=utf-8');
require_once __DIR__ . '/../config/cors.php';
header('Content-Disposition: attachment; filename="reports_export.csv"');

require_once __DIR__ . '/../middleware/auth.php';
requireRole(['Admin', 'Super Admin']);

require_once __DIR__ . '/../config/database.php';

$status = $_GET['status'] ?? 'All';
$category = $_GET['category'] ?? 'All';

$where = [];
$params = [];

/*
 * Optional selected-ids export (comma-separated ref_ids).
 * When present it takes precedence over status/category filters.
 */
$idsRaw = trim($_GET['ids'] ?? '');
$selectedIds = [];
if ($idsRaw !== '') {
  foreach (explode(',', $idsRaw) as $oneId) {
    $oneId = trim($oneId);
    if ($oneId !== '') $selectedIds[] = $oneId;
  }
  $selectedIds = array_slice($selectedIds, 0, 200);
}

if (count($selectedIds) > 0) {
  $placeholders = implode(',', array_fill(0, count($selectedIds), '?'));
  $where[] = "r.ref_id IN ($placeholders)";
  foreach ($selectedIds as $oneId) { $params[] = $oneId; }
} else {
  if ($status !== 'All') { $where[] = 'r.status = ?'; $params[] = $status; }
  if ($category !== 'All') { $where[] = 'r.category = ?'; $params[] = $category; }
}
$whereClause = $where ? 'WHERE ' . implode(' AND ', $where) : '';

$stmt = $pdo->prepare("SELECT r.ref_id, r.title, r.category, r.location, r.status, r.reporter_name, r.created_at, u.name AS assigned_name FROM reports r LEFT JOIN users u ON r.assigned_to = u.id $whereClause ORDER BY r.created_at DESC");
$stmt->execute($params);
$rows = $stmt->fetchAll();

$output = fopen('php://output', 'w');
fputcsv($output, ['ID', 'Title', 'Category', 'Location', 'Status', 'Reporter', 'Assigned To', 'Date']);

foreach ($rows as $r) {
  fputcsv($output, [$r['ref_id'], $r['title'], $r['category'], $r['location'], $r['status'], $r['reporter_name'] ?? 'Anonymous', $r['assigned_name'] ?? '-', $r['created_at']]);
}

fclose($output);
