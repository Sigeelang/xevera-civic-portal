<?php
header('Content-Type: application/json');
require_once __DIR__ . '/../config/cors.php';

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }

require_once __DIR__ . '/../middleware/auth.php';
$me = requirePermission('backup', ['Super Admin']);

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/backup.php';

/*
 * Pure-PHP database dump. Previously this shelled out to `mysqldump`,
 * which is not installed on the production host (and was never given
 * the DB password), so every backup failed. This uses the existing PDO
 * connection instead — no system dependencies.
 */

$input = json_decode(file_get_contents('php://input'), true) ?: [];
$description = trim((string)($input['description'] ?? ''));

$dbName = getenv('DB_NAME') ?: 'xevera_civic';
$file = xevera_backup_dir() . DIRECTORY_SEPARATOR . 'backup_' . date('Y-m-d_H-i-s') . '.sql';

function xevera_backup_ident(string $name): string {
    return '`' . str_replace('`', '``', $name) . '`';
}

try {
    // Stream rows unbuffered so large tables cannot exhaust PHP memory.
    $pdo->setAttribute(PDO::MYSQL_ATTR_USE_BUFFERED_QUERY, false);

    $fh = @fopen($file, 'wb');
    if (!$fh) {
        throw new RuntimeException('Cannot write backup file.');
    }
    $write = function (string $s) use ($fh): void {
        if (fwrite($fh, $s) === false) {
            throw new RuntimeException('Failed while writing backup file.');
        }
    };

    $write("-- Xevera database backup\n-- Database: {$dbName}\n-- Created: " . date('Y-m-d H:i:s') . "\n\n");
    $write("SET NAMES utf8mb4;\nSET FOREIGN_KEY_CHECKS=0;\n");

    // Collect base tables and views.
    $tables = [];
    $views = [];
    foreach ($pdo->query('SHOW FULL TABLES') as $row) {
        $vals = array_values($row);
        if (!isset($vals[0])) continue;
        if (($vals[1] ?? '') === 'VIEW') $views[] = $vals[0];
        else $tables[] = $vals[0];
    }

    foreach ($tables as $table) {
        $t = xevera_backup_ident($table);
        $create = $pdo->query("SHOW CREATE TABLE $t")->fetch();
        $createSql = $create['Create Table'] ?? '';
        if ($createSql === '') {
            throw new RuntimeException("Cannot read schema for table {$table}.");
        }
        $write("\n-- Table: {$table}\nDROP TABLE IF EXISTS $t;\n" . $createSql . ";\n");

        $stmt = $pdo->query("SELECT * FROM $t");
        $cols = [];
        for ($i = 0; $i < $stmt->columnCount(); $i++) {
            $meta = $stmt->getColumnMeta($i);
            $cols[] = xevera_backup_ident($meta['name'] ?? ("col$i"));
        }
        $colList = implode(',', $cols);
        $batch = [];
        $flush = function () use (&$batch, $t, $colList, $write): void {
            if (!$batch) return;
            $write("INSERT INTO $t ($colList) VALUES\n" . implode(",\n", $batch) . ";\n");
            $batch = [];
        };
        while (($r = $stmt->fetch(PDO::FETCH_NUM)) !== false) {
            $vals = [];
            foreach ($r as $v) {
                $vals[] = $v === null ? 'NULL' : $pdo->quote((string)$v);
            }
            $batch[] = '(' . implode(',', $vals) . ')';
            if (count($batch) >= 200) $flush();
        }
        $flush();
        $stmt->closeCursor();
    }

    foreach ($views as $view) {
        $v = xevera_backup_ident($view);
        $vc = $pdo->query("SHOW CREATE VIEW $v")->fetch();
        $createView = $vc['Create View'] ?? '';
        if ($createView !== '') {
            $write("\n-- View: {$view}\nDROP VIEW IF EXISTS $v;\n" . $createView . ";\n");
        }
    }

    // Triggers (DELIMITER-wrapped, mysqldump style).
    try {
        $triggers = $pdo->query('SHOW TRIGGERS')->fetchAll();
    } catch (Throwable $e) {
        $triggers = [];
    }
    foreach ($triggers as $tr) {
        $name = $tr['Trigger'] ?? null;
        if (!$name) continue;
        $tc = $pdo->query('SHOW CREATE TRIGGER ' . xevera_backup_ident($name))->fetch();
        $sqlText = $tc['SQL Original Statement'] ?? null;
        if ($sqlText) {
            $write("\nDELIMITER ;;\nDROP TRIGGER IF EXISTS " . xevera_backup_ident($name) . ";;\n" . rtrim($sqlText, ';') . ";;\nDELIMITER ;\n");
        }
    }

    $write("\nSET FOREIGN_KEY_CHECKS=1;\n");
    fclose($fh);

    clearstatcache(true, $file);
    if (!is_file($file) || filesize($file) < 100) {
        @unlink($file);
        throw new RuntimeException('Backup is empty.');
    }

    $detail = 'Created database backup: ' . basename($file);
    if ($description !== '') $detail .= ' (' . $description . ')';
    $stmt = $pdo->prepare('INSERT INTO activity_logs (user_id, action, target_type, target_id, detail) VALUES (?, ?, ?, NULL, ?)');
    $stmt->execute([(int)$me['user_id'], 'create_backup', 'backup', $detail]);
    echo json_encode(['success' => true, 'file' => basename($file)]);
} catch (Throwable $e) {
    if (isset($fh) && is_resource($fh)) fclose($fh);
    @unlink($file);
    error_log('xevera_backup: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['error' => 'Backup failed.']);
}
