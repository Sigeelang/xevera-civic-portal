<?php
header('Content-Type: application/json');
require_once __DIR__ . '/../config/cors.php';

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }

require_once __DIR__ . '/../middleware/auth.php';
requireRole(['Admin', 'Super Admin']);

try {
  require_once __DIR__ . '/../config/database.php';

  $stmt = $pdo->query('SELECT COUNT(*) FROM reports');
  $reports = (int)$stmt->fetchColumn();

  $stmt = $pdo->query('SELECT COUNT(*) FROM users');
  $users = (int)$stmt->fetchColumn();

  $stmt = $pdo->query('SELECT COUNT(*) FROM activity_logs');
  $logs = (int)$stmt->fetchColumn();

  $diskFree = disk_free_space(__DIR__ . '/../..');
  $diskTotal = disk_total_space(__DIR__ . '/../..');

  echo json_encode([
    'status' => 'healthy',
    'database' => 'connected',
    'stats' => [
      'reports' => $reports,
      'users' => $users,
      'activity_logs' => $logs,
    ],
    'disk_free_gb' => round($diskFree / 1073741824, 2),
    'disk_total_gb' => round($diskTotal / 1073741824, 2),
    'php_version' => phpversion(),
    'server_time' => date('Y-m-d H:i:s'),
  ]);
} catch (Exception $e) {
  http_response_code(500);
  echo json_encode(['status' => 'unhealthy', 'error' => $e->getMessage()]);
}
