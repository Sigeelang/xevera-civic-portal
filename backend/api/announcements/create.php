<?php
header('Content-Type: application/json');
require_once __DIR__ . '/../config/cors.php';

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }
if ($_SERVER['REQUEST_METHOD'] !== 'POST') { http_response_code(405); echo json_encode(['error' => 'Method not allowed']); exit; }

require_once __DIR__ . '/../middleware/auth.php';
require_once __DIR__ . '/../middleware/write_ratelimit.php';
require_once __DIR__ . '/../middleware/upload.php';
$user = requireRole(['Admin', 'Super Admin']);
xevera_write_rate_limit($pdo, 'announcements.create');

require_once __DIR__ . '/../config/database.php';

$isMultipart = isset($_SERVER['CONTENT_TYPE']) && strpos($_SERVER['CONTENT_TYPE'], 'multipart/form-data') !== false;
$input = $isMultipart ? $_POST : (json_decode(file_get_contents('php://input'), true) ?: []);

$title = trim($input['title'] ?? '');
$content = trim($input['content'] ?? '');
$category = strtolower(trim($input['category'] ?? 'general'));
if ($category === 'garbage schedule') $category = 'garbage';
if ($category === 'event') $category = 'events';
$allowedCategories = ['general', 'maintenance', 'safety', 'events', 'garbage', 'advisory'];
if (!in_array($category, $allowedCategories, true)) $category = 'general';
$priority = trim($input['priority'] ?? 'Normal');
$audience = trim($input['audience'] ?? 'All Residents');
$visibility = trim($input['visibility'] ?? 'Public');
$sendNotification = isset($input['send_notification']) ? (int)(bool)$input['send_notification'] : 1;
$publishOption = trim($input['publish_option'] ?? 'now');

if (!$title || !$content) { http_response_code(400); echo json_encode(['error' => 'Title and content are required.']); exit; }
if (mb_strlen($title) > 190 || mb_strlen($content) > 10000) { http_response_code(400); echo json_encode(['error' => 'Title (max 190) or content (max 10000) is too long.']); exit; }

$publishAt = null;
$status = trim($input['status'] ?? 'published');
if ($publishOption === 'schedule' && !empty($input['publish_at'])) {
    $publishAt = date('Y-m-d H:i:s', strtotime($input['publish_at']));
    $status = 'scheduled';
}

$coverImage = null;
if ($isMultipart && !empty($_FILES['cover_image']) && $_FILES['cover_image']['error'] === UPLOAD_ERR_OK) {
    $validated = xevera_validate_image_upload($_FILES['cover_image']);
    $ext = $validated['ext'];
    $uploadDir = __DIR__ . '/../../uploads/';
    if (!is_dir($uploadDir)) mkdir($uploadDir, 0755, true);
    $name = 'announcement_' . bin2hex(random_bytes(6)) . '.' . $ext;
    if (move_uploaded_file($_FILES['cover_image']['tmp_name'], $uploadDir . $name)) {
        $coverImage = 'uploads/' . $name;
    }
}

$scheduleLabel = trim($input['schedule_label'] ?? $input['schedule_day'] ?? '');
$area = trim($input['area'] ?? '');
$scheduleTime = trim($input['schedule_time'] ?? '');
$recurrence = trim($input['recurrence'] ?? '');
$stmt = $pdo->prepare('INSERT INTO announcements (title, content, category, status, priority, audience, visibility, publish_at, cover_image, send_notification, created_by, schedule_label, schedule_time, recurrence, area) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
$stmt->execute([$title, $content, $category, $status, $priority, $audience, $visibility, $publishAt, $coverImage, $sendNotification, $user['user_id'], $scheduleLabel ?: null, $scheduleTime ?: null, $recurrence ?: null, $area ?: null]);

$announcementId = (int)$pdo->lastInsertId();

/*
 * Send Notification:
 * When an announcement is published immediately and the toggle is on,
 * create a notification for every active resident.
 */
if ($sendNotification && $status === 'published') {
    $residentIds = $pdo->query("SELECT id FROM users WHERE role = 'Resident' AND status = 'Active'")->fetchAll(PDO::FETCH_COLUMN);

    if ($residentIds) {
        $notifStmt = $pdo->prepare("INSERT INTO notifications (user_id, report_id, announcement_id, type, message) VALUES (?, NULL, ?, 'announcement', ?)");
        foreach ($residentIds as $residentId) {
            $notifStmt->execute([(int)$residentId, $announcementId, $title]);
        }
    }
}

echo json_encode(['success' => true, 'id' => $announcementId]);