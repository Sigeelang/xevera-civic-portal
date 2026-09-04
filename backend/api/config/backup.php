<?php
function xevera_backup_dir(): string {
    // Store outside the API webroot (but inside backend/) so dumps are not directly downloadable.
    $dir = dirname(__DIR__, 2) . DIRECTORY_SEPARATOR . 'backups';
    if (!is_dir($dir)) {
        @mkdir($dir, 0755, true);
    }
    return $dir;
}

function xevera_backup_list(): array {
    $dir = xevera_backup_dir();
    $items = [];
    if (is_dir($dir)) {
        $files = glob($dir . '/*.sql');
        if ($files !== false) {
            foreach ($files as $f) {
                $items[] = [
                    'name' => basename($f),
                    'size' => filesize($f),
                    'size_mb' => round(filesize($f) / 1048576, 2),
                    'modified' => date('Y-m-d H:i:s', filemtime($f)),
                    'type' => 'manual',
                ];
            }
        }
    }
    usort($items, fn($a, $b) => strcmp($b['modified'], $a['modified']));
    return $items;
}