<?php
/**
 * Filtered report statistics for the Export Reports page.
 * Mirrors the filtering of export/custom.php so the numbers match
 * what an export would contain.
 *
 * GET params: from, to (Y-m-d), status, category, assigned (user id),
 *             location (partial match)
 */
header('Content-Type: application/json');
require_once __DIR__ . '/../config/cors.php';

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }

require_once __DIR__ . '/../middleware/auth.php';
requireRole(['Admin', 'Super Admin']);

require_once __DIR__ . '/../config/database.php';

$from = preg_match('/^\d{4}-\d{2}-\d{2}$/', $_GET['from'] ?? '') ? $_GET['from'] : null;
$to = preg_match('/^\d{4}-\d{2}-\d{2}$/', $_GET['to'] ?? '') ? $_GET['to'] : null;
$status = $_GET['status'] ?? 'All';
$category = $_GET['category'] ?? 'All';
$assigned = $_GET['assigned'] ?? 'All';
$location = trim($_GET['location'] ?? '');

$where = [];
$params = [];

if ($from) { $where[] = 'created_at >= ?'; $params[] = $from . ' 00:00:00'; }
if ($to) { $where[] = 'created_at <= ?'; $params[] = $to . ' 23:59:59'; }
if ($status !== 'All' && $status !== '') { $where[] = 'status = ?'; $params[] = $status; }
if ($category !== 'All' && $category !== '') { $where[] = 'category = ?'; $params[] = $category; }
if ($assigned !== 'All' && $assigned !== '' && ctype_digit($assigned)) { $where[] = 'assigned_to = ?'; $params[] = (int)$assigned; }
if ($location !== '') { $where[] = 'location LIKE ?'; $params[] = '%' . $location . '%'; }

$whereClause = $where ? 'WHERE ' . implode(' AND ', $where) : '';

function countFiltered(PDO $pdo, string $whereClause, array $params, ?string $statusOverride = null): int {
    $sql = 'SELECT COUNT(*) FROM reports ' . $whereClause;
    if ($statusOverride !== null) {
        $sql .= (strpos($whereClause, 'WHERE') === false ? ' WHERE status = ?' : ' AND status = ?');
        $params = array_merge($params, [$statusOverride]);
    }
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    return (int)$stmt->fetchColumn();
}

// When a specific status is selected, "total" equals that status count.
$total = countFiltered($pdo, $whereClause, $params, null);
$pending = ($status !== 'All' && $status !== '')
    ? ($status === 'Pending' ? $total : 0)
    : countFiltered($pdo, $whereClause, $params, 'Pending');
$inProgress = ($status !== 'All' && $status !== '')
    ? ($status === 'In Progress' ? $total : 0)
    : countFiltered($pdo, $whereClause, $params, 'In Progress');
$resolved = ($status !== 'All' && $status !== '')
    ? ($status === 'Resolved' ? $total : 0)
    : countFiltered($pdo, $whereClause, $params, 'Resolved');
$closed = ($status !== 'All' && $status !== '')
    ? ($status === 'Closed' ? $total : 0)
    : countFiltered($pdo, $whereClause, $params, 'Closed');

echo json_encode([
    'total' => $total,
    'pending' => $pending,
    'in_progress' => $inProgress,
    'resolved' => $resolved,
    'closed' => $closed,
]);
