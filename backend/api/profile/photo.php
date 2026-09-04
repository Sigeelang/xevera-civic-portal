<?php
header('Content-Type: application/json');
require_once __DIR__ . '/../config/cors.php';

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }
if ($_SERVER['REQUEST_METHOD'] !== 'POST') { http_response_code(405); echo json_encode(['error' => 'Method not allowed']); exit; }

require_once __DIR__ . '/../middleware/auth.php';
$user = requireAuth();

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../middleware/upload.php';

$uid = (int)$user['user_id'];
$action = $_POST['action'] ?? 'upload';

// Remove photo
if ($action === 'remove') {
    $stmt = $pdo->prepare('SELECT profile_photo FROM users WHERE id = ?');
    $stmt->execute([$uid]);
    $old = $stmt->fetchColumn();
    if ($old) {
        $oldName = basename($old);
        $oldFile = __DIR__ . '/../../uploads/' . $oldName;
        if (is_file($oldFile)) @unlink($oldFile);
    }
    $stmt = $pdo->prepare('UPDATE users SET profile_photo = NULL WHERE id = ?');
    $stmt->execute([$uid]);
    echo json_encode(['success' => true, 'profile_photo' => null]);
    exit;
}

// Upload photo
if (empty($_FILES['photo']) || $_FILES['photo']['error'] !== UPLOAD_ERR_OK) {
    http_response_code(400);
    echo json_encode(['error' => 'No image uploaded.']);
    exit;
}

$validated = xevera_validate_image_upload($_FILES['photo']);
$ext = $validated['ext'];

$uploadDir = __DIR__ . '/../../uploads/';
if (!is_dir($uploadDir)) mkdir($uploadDir, 0755, true);

// Remove old
$stmt = $pdo->prepare('SELECT profile_photo FROM users WHERE id = ?');
$stmt->execute([$uid]);
$old = $stmt->fetchColumn();
if ($old) {
    $oldName = basename($old);
    $oldFile = $uploadDir . $oldName;
    if (is_file($oldFile)) @unlink($oldFile);
}

$name = 'profile_' . $uid . '_' . bin2hex(random_bytes(6)) . '.' . $ext;
$target = $uploadDir . $name;
if (!move_uploaded_file($_FILES['photo']['tmp_name'], $target)) {
    http_response_code(500);
    echo json_encode(['error' => 'Failed to save image.']);
    exit;
}

$path = 'uploads/' . $name;
$stmt = $pdo->prepare('UPDATE users SET profile_photo = ? WHERE id = ?');
$stmt->execute([$path, $uid]);

$logStmt = $pdo->prepare('INSERT INTO activity_logs (user_id, action, target_type, target_id, detail) VALUES (?, ?, ?, NULL, ?)');
$logStmt->execute([$uid, 'update_profile_photo', 'user', 'Updated profile photo']);

echo json_encode(['success' => true, 'profile_photo' => $path]);