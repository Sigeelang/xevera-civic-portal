<?php
header('Content-Type: application/json');
require_once __DIR__ . '/../config/cors.php';

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }

require_once __DIR__ . '/../middleware/auth.php';
$me = requirePermission('backup', ['Super Admin']);

require_once __DIR__ . '/../config/database.php';

$input = json_decode(file_get_contents('php://input'), true) ?: [];
$description = trim((string)($input['description'] ?? ''));

$db_host = getenv('DB_HOST') ?: 'localhost';
$db_user = getenv('DB_USER') ?: 'root';
$db_pass = getenv('DB_PASS') ?: '';
$db_name = getenv('DB_NAME') ?: 'xevera_civic';

$backupFile = __DIR__ . '/../../backups/backup_' . date('Y-m-d_H-i-s') . '.sql';

if (!is_dir(__DIR__ . '/../../backups')) {
  mkdir(__DIR__ . '/../../backups', 0755, true);
}

$cmd = sprintf('mysqldump -h %s -u %s %s > %s', escapeshellarg($db_host), escapeshellarg($db_user), escapeshellarg($db_name), escapeshellarg($backupFile));

exec($cmd, $output, $exitCode);

if ($exitCode === 0) {
  $detail = 'Created database backup: ' . basename($backupFile);
  if ($description !== '') $detail .= ' (' . $description . ')';
  $stmt = $pdo->prepare('INSERT INTO activity_logs (user_id, action, target_type, target_id, detail) VALUES (?, ?, ?, NULL, ?)');
  $stmt->execute([(int)$me['user_id'], 'create_backup', 'backup', $detail]);
  echo json_encode(['success' => true, 'file' => basename($backupFile)]);
} else {
  http_response_code(500);
  echo json_encode(['error' => 'Backup failed.']);
}
