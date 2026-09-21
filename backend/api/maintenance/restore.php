<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

require_once __DIR__ . '/../middleware/auth.php';
$me = requirePermission('backup', ['Super Admin']);

require_once __DIR__ . '/../config/backup.php';

/*
 * Pure-PHP SQL import. Previously this shelled out to the `mysql`
 * client, which is not installed on the production host, so every
 * restore failed. Statements execute sequentially over PDO (same
 * semantics as piping a dump into the mysql CLI).
 */

$input = json_decode(file_get_contents('php://input'), true);
$name = trim($input['name'] ?? '');
if ($name === '' || strpos($name, '..') !== false || !preg_match('/^[A-Za-z0-9._-]+$/', $name)) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid backup file.']);
    exit;
}

$file = xevera_backup_dir() . DIRECTORY_SEPARATOR . $name . '.sql';
if (!is_file($file)) {
    http_response_code(404);
    echo json_encode(['error' => 'Backup not found.']);
    exit;
}

/*
 * Split a dump into statements. Understands DELIMITER directives
 * (used for triggers), strips -- / # line comments and block
 * comments, and ignores semicolons inside quoted strings.
 */
function xevera_split_sql(string $sql): array {
    $statements = [];
    $buf = '';
    $delimiter = ';';
    $inS = $inD = $inB = $inC = false;
    $len = strlen($sql);
    $i = 0;
    $lineStart = true;
    while ($i < $len) {
        // Line-start directives (outside strings/comments).
        if ($lineStart && !$inS && !$inD && !$inB && !$inC) {
            $rest = substr($sql, $i);
            if (strncasecmp($rest, 'delimiter ', 10) === 0) {
                $eol = strpos($rest, "\n");
                $d = trim(substr($rest, 10, $eol === false ? null : $eol - 10));
                $delimiter = $d !== '' ? $d : ';';
                $i += ($eol === false ? strlen($rest) : $eol + 1);
                continue;
            }
            if (strncmp($rest, '--', 2) === 0 || ($rest !== '' && $rest[0] === '#')) {
                $eol = strpos($rest, "\n");
                $i += ($eol === false ? strlen($rest) : $eol + 1);
                continue;
            }
        }
        $ch = $sql[$i];
        $nxt = $i + 1 < $len ? $sql[$i + 1] : '';
        if ($inC) {
            if ($ch === '*' && $nxt === '/') {
                $inC = false;
                $i += 2;
            } else {
                if ($ch === "\n") $lineStart = true;
                $i++;
            }
            continue;
        }
        if (!$inS && !$inD && !$inB && $ch === '/' && $nxt === '*') {
            $inC = true;
            $i += 2;
            $lineStart = false;
            continue;
        }
        if ($ch === "'" && !$inD && !$inB) {
            if ($inS && $nxt === "'") {
                $buf .= "''";
                $i += 2;
                $lineStart = false;
                continue;
            }
            $prev = $i > 0 ? $sql[$i - 1] : '';
            if (!$inS || $prev !== '\\') $inS = !$inS;
        } elseif ($ch === '"' && !$inS && !$inB) {
            $prev = $i > 0 ? $sql[$i - 1] : '';
            if (!$inD || $prev !== '\\') $inD = !$inD;
        } elseif ($ch === '`' && !$inS && !$inD) {
            $inB = !$inB;
        }
        $buf .= $ch;
        $lineStart = ($ch === "\n");
        if (!$inS && !$inD && !$inB && $delimiter !== '') {
            $dl = strlen($delimiter);
            if (substr($buf, -$dl) === $delimiter) {
                $stmt = trim(substr($buf, 0, -$dl));
                if (trim($stmt, " \t\n\r;") !== '') $statements[] = $stmt;
                $buf = '';
            }
        }
        $i++;
    }
    if (trim($buf, " \t\n\r;") !== '') {
        $statements[] = trim($buf);
    }
    return $statements;
}

try {
    $sql = file_get_contents($file);
    if ($sql === false || trim($sql) === '') {
        throw new RuntimeException('Backup file is empty.');
    }
    $statements = xevera_split_sql($sql);
    if (!$statements) {
        throw new RuntimeException('No statements found in backup file.');
    }

    $executed = 0;
    foreach ($statements as $stmt) {
        $pdo->exec($stmt);
        $executed++;
    }

    $stmt = $pdo->prepare('INSERT INTO activity_logs (user_id, action, target_type, target_id, detail) VALUES (?, ?, ?, NULL, ?)');
    $stmt->execute([(int)$me['user_id'], 'restore_backup', 'backup', 'Restored database from: ' . $name . '.sql']);

    echo json_encode(['success' => true, 'message' => 'Database restored successfully from ' . $name . '.sql']);
} catch (Throwable $e) {
    error_log('xevera_restore: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['error' => 'Restore failed: ' . $e->getMessage()]);
}
