<?php
/**
 * Admin endpoint to retry queued emails that failed to send via SMTP.
 * Used when the primary SMTP provider (Gmail) is rate-limited or down,
 * and the application has saved the message to disk for later delivery.
 *
 * Auth: Super Admin only.
 */
header('Content-Type: application/json');
require_once __DIR__ . '/../config/cors.php';

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

if (!in_array($_SERVER['REQUEST_METHOD'], ['GET', 'POST'], true)) {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

require_once __DIR__ . '/../middleware/auth.php';
requireRole(['Super Admin']);

require_once __DIR__ . '/../config/mailer.php';

$action = $_GET['action'] ?? $_POST['action'] ?? 'status';
$max = (int) ($_GET['max'] ?? $_POST['max'] ?? 50);
if ($max < 1) $max = 1;
if ($max > 500) $max = 500;

if ($action === 'status') {
    echo json_encode([
        'queued' => xevera_mail_queue_count(),
    ]);
    exit;
}

if ($action === 'retry') {
    $result = xevera_mail_queue_retry($max);
    echo json_encode($result);
    exit;
}

http_response_code(400);
echo json_encode(['error' => "Unknown action: {$action}. Use 'status' or 'retry'."]);
