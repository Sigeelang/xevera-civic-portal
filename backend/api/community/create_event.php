<?php
/**
 * Creates a community/calendar event.
 * Used by the Super Admin Calendar "Add Event" modal.
 */
header('Content-Type: application/json');
require_once __DIR__ . '/../config/cors.php';

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

require_once __DIR__ . '/../middleware/auth.php';
$currentUser = requireRole(['Staff', 'Admin', 'Super Admin']);

require_once __DIR__ . '/../config/database.php';

$input = json_decode(file_get_contents('php://input'), true);

$title = trim($input['title'] ?? '');
$date = trim($input['date'] ?? '');
$time = trim($input['time'] ?? '08:00');
$location = trim($input['location'] ?? '');
$category = trim($input['category'] ?? 'Community Event');

if ($title === '' || $date === '') {
    http_response_code(400);
    echo json_encode(['error' => 'Event name and date are required.']);
    exit;
}

if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid date format.']);
    exit;
}

if (!preg_match('/^\d{2}:\d{2}$/', $time)) {
    $time = '08:00';
}

$startsAt = $date . ' ' . $time . ':00';

$stmt = $pdo->prepare('INSERT INTO community_events (title, description, location, category, starts_at) VALUES (?, ?, ?, ?, ?)');
$stmt->execute([$title, '', $location, $category, $startsAt]);

$logStmt = $pdo->prepare('INSERT INTO activity_logs (user_id, action, target_type, target_id, detail) VALUES (?, ?, ?, NULL, ?)');
$logStmt->execute([$currentUser['user_id'], 'create_calendar_event', 'calendar_event', 'Added calendar event: ' . $title]);

echo json_encode([
    'success' => true,
    'id' => (int)$pdo->lastInsertId(),
    'message' => 'Event added successfully.',
]);
