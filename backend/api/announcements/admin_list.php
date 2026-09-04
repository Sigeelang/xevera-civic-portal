<?php
header('Content-Type: application/json');
require_once __DIR__ . '/../config/cors.php';

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }

require_once __DIR__ . '/../middleware/auth.php';
requireRole(['Admin', 'Super Admin']);

require_once __DIR__ . '/../config/database.php';

/*
 * Lazy auto-publish:
 * Flip scheduled announcements whose publish time has passed so
 * admins see them go live without needing an external cron job.
 */
$pdo->exec("UPDATE announcements SET status = 'published' WHERE status = 'scheduled' AND publish_at IS NOT NULL AND publish_at <= NOW()");

$stmt = $pdo->query("SELECT a.*, u.name AS author_name FROM announcements a LEFT JOIN users u ON a.created_by = u.id ORDER BY a.created_at DESC");
echo json_encode($stmt->fetchAll());
