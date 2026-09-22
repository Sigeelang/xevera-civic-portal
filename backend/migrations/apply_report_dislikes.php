<?php
/*
 * One-shot migration: report dislikes.
 *
 * - report_dislikes(report_id, user_id) with UNIQUE(report_id, user_id)
 * - reports.dislikes counter column
 *
 * CLI ONLY: php apply_report_dislikes.php
 * Safe to run multiple times.
 */

if (php_sapi_name() !== 'cli') {
    http_response_code(403);
    echo json_encode(['error' => 'CLI only.']);
    exit;
}

require_once __DIR__ . '/../api/config/database.php';

$out = ['ok' => true, 'steps' => []];

try {
    $pdo->exec("CREATE TABLE IF NOT EXISTS report_dislikes (
        id INT AUTO_INCREMENT PRIMARY KEY,
        report_id INT NOT NULL,
        user_id INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uq_report_user (report_id, user_id),
        KEY idx_rd_report (report_id),
        CONSTRAINT fk_rd_report FOREIGN KEY (report_id) REFERENCES reports(id) ON DELETE CASCADE,
        CONSTRAINT fk_rd_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    $out['steps']['report_dislikes'] = 'ready';
} catch (Throwable $e) {
    $out['ok'] = false;
    $out['steps']['report_dislikes'] = 'ERROR: ' . $e->getMessage();
}

try {
    $row = $pdo->query("SHOW COLUMNS FROM reports LIKE 'dislikes'")->fetch();
    if ($row) {
        $out['steps']['reports.dislikes'] = 'already present';
    } else {
        $pdo->exec('ALTER TABLE reports ADD COLUMN dislikes INT NOT NULL DEFAULT 0 AFTER likes');
        $out['steps']['reports.dislikes'] = 'added';
    }
} catch (Throwable $e) {
    $out['ok'] = false;
    $out['steps']['reports.dislikes'] = 'ERROR: ' . $e->getMessage();
}

echo json_encode($out, JSON_PRETTY_PRINT) . PHP_EOL;
exit($out['ok'] ? 0 : 1);
