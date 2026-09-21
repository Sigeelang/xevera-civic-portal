<?php
header('Content-Type: application/json');
require_once __DIR__ . '/../config/cors.php';

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }
if ($_SERVER['REQUEST_METHOD'] !== 'POST') { http_response_code(405); echo json_encode(['error' => 'Method not allowed']); exit; }

require_once __DIR__ . '/../middleware/auth.php';
require_once __DIR__ . '/../middleware/write_ratelimit.php';
require_once __DIR__ . '/../middleware/upload.php';
requirePermission('announcements', ['Admin', 'Super Admin']);
xevera_write_rate_limit($pdo, 'announcements.update');

require_once __DIR__ . '/../config/database.php';

$isMultipart = isset($_SERVER['CONTENT_TYPE']) && strpos($_SERVER['CONTENT_TYPE'], 'multipart/form-data') !== false;
$input = $isMultipart ? $_POST : (json_decode(file_get_contents('php://input'), true) ?: []);

$id = (int)($input['id'] ?? 0);
$title = trim($input['title'] ?? '');
$content = trim($input['content'] ?? '');
$category = strtolower(trim($input['category'] ?? 'general'));
if ($category === 'garbage schedule') $category = 'garbage';
if ($category === 'event') $category = 'events';
$allowedCategories = ['general', 'maintenance', 'safety', 'events', 'garbage', 'advisory'];
if (!in_array($category, $allowedCategories, true)) $category = 'general';
$status = trim($input['status'] ?? 'published');
$priority = trim($input['priority'] ?? 'Normal');
$audience = trim($input['audience'] ?? 'All Residents');
$visibility = trim($input['visibility'] ?? 'Public');
$sendNotification = isset($input['send_notification']) ? (int)(bool)$input['send_notification'] : 1;

if (!$id || !$title || !$content) { http_response_code(400); echo json_encode(['error' => 'Invalid input.']); exit; }
if (mb_strlen($title) > 190 || mb_strlen($content) > 10000) { http_response_code(400); echo json_encode(['error' => 'Title (max 190) or content (max 10000) is too long.']); exit; }

$publishAt = null;
$publishOption = trim($input['publish_option'] ?? '');
if ($publishOption === 'schedule' && !empty($input['publish_at'])) {
    $publishAt = date('Y-m-d H:i:s', strtotime($input['publish_at']));
    $status = 'scheduled';
} elseif (array_key_exists('publish_at', $input)) {
    $publishAt = $input['publish_at'] ? date('Y-m-d H:i:s', strtotime($input['publish_at'])) : null;
}

$scheduleLabel = trim($input['schedule_label'] ?? $input['schedule_day'] ?? '');
$area = trim($input['area'] ?? '');
$scheduleTime = trim($input['schedule_time'] ?? '');
$recurrence = trim($input['recurrence'] ?? '');
$stmt = $pdo->prepare('UPDATE announcements SET title = ?, content = ?, category = ?, status = ?, priority = ?, audience = ?, visibility = ?, publish_at = ?, send_notification = ?, schedule_label = ?, schedule_time = ?, recurrence = ?, area = ? WHERE id = ?');
$stmt->execute([$title, $content, $category, $status, $priority, $audience, $visibility, $publishAt, $sendNotification, $scheduleLabel ?: null, $scheduleTime ?: null, $recurrence ?: null, $area ?: null, $id]);

if ($isMultipart && !empty($_FILES['cover_image']) && $_FILES['cover_image']['error'] === UPLOAD_ERR_OK) {
    $validated = xevera_validate_image_upload($_FILES['cover_image']);
    $ext = $validated['ext'];
    $uploadDir = __DIR__ . '/../../uploads/';
    if (!is_dir($uploadDir)) mkdir($uploadDir, 0755, true);
    $name = 'announcement_' . bin2hex(random_bytes(6)) . '.' . $ext;
    if (move_uploaded_file($_FILES['cover_image']['tmp_name'], $uploadDir . $name)) {
        $stmt = $pdo->prepare('UPDATE announcements SET cover_image = ? WHERE id = ?');
        $stmt->execute(['uploads/' . $name, $id]);
    }
}

echo json_encode(['success' => true]);

/*
 * Send notification when announcement is published (status changed to published).
 */
if ($sendNotification && $status === 'published') {
    try {
        $allUserIds = $pdo->query("SELECT id FROM users WHERE role IN ('Resident', 'Admin', 'Super Admin') AND status = 'Active'")->fetchAll(PDO::FETCH_COLUMN);
        if ($allUserIds) {
            $notifStmt = $pdo->prepare("INSERT INTO notifications (user_id, report_id, announcement_id, type, message) VALUES (?, NULL, ?, 'announcement', ?)");
            foreach ($allUserIds as $uid) {
                $notifStmt->execute([(int)$uid, $id, $title]);
            }
        }
    } catch (PDOException $e) { /* notification failure must not break the update response */ }
}