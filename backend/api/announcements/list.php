<?php
header('Content-Type: application/json');
require_once __DIR__ . '/../config/cors.php';

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }

require_once __DIR__ . '/../middleware/auth.php';
require_once __DIR__ . '/../config/database.php';

/*
 * Lazy auto-publish:
 * Flip scheduled announcements whose publish time has passed so
 * they become visible without needing an external cron job.
 */
$pdo->exec("UPDATE announcements SET status = 'published' WHERE status = 'scheduled' AND publish_at IS NOT NULL AND publish_at <= NOW()");

/*
 * Optional auth - this endpoint stays public for guests.
 *   Guest / invalid token : only visibility = 'Public'
 *   Resident              : 'Public' + 'Residents Only'
 *   Staff/Admin/Super Adm : everything published
 */
$payload = token_payload();
$role = $payload['role'] ?? '';

$base = "SELECT a.*, u.name AS author_name FROM announcements a LEFT JOIN users u ON a.created_by = u.id WHERE a.status = 'published'";

if (in_array($role, ['Staff', 'Admin', 'Super Admin'], true)) {
    $stmt = $pdo->query($base . " ORDER BY a.created_at DESC");
} elseif ($role === 'Resident') {
    $stmt = $pdo->prepare($base . " AND a.visibility IN ('Public', 'Residents Only') ORDER BY a.created_at DESC");
    $stmt->execute();
} else {
    $stmt = $pdo->prepare($base . " AND a.visibility = 'Public' ORDER BY a.created_at DESC");
    $stmt->execute();
}

echo json_encode($stmt->fetchAll());
