<?php
header('Content-Type: application/json');
require_once __DIR__ . '/../config/cors.php';

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../middleware/upload.php';

require_once __DIR__ . '/../middleware/ratelimit.php';
require_once __DIR__ . '/../middleware/token.php';

$title = trim($_POST['title'] ?? '');
$category = $_POST['category'] ?? '';
$description = trim($_POST['description'] ?? '');
$location = trim($_POST['location'] ?? '');
$reporterName = trim($_POST['reporter_name'] ?? 'Anonymous');
$reporterPhone = trim($_POST['reporter_phone'] ?? '');
$reporterEmail = trim($_POST['reporter_email'] ?? '');

if (!$title || !$category || !$description || !$location) {
    http_response_code(400);
    echo json_encode(['error' => 'Title, category, description, and location are required.']);
    exit;
}

/* Input length + format validation (backend-enforced, mirrors frontend limits). */
if (mb_strlen($title) > 190 || mb_strlen($location) > 255 || mb_strlen($description) > 5000) {
    http_response_code(400);
    echo json_encode(['error' => 'Title (max 190), location (max 255), or description (max 5000) is too long.']);
    exit;
}
if (mb_strlen($reporterName) > 120 || mb_strlen($reporterPhone) > 30) {
    http_response_code(400);
    echo json_encode(['error' => 'Reporter name (max 120) or phone (max 30) is too long.']);
    exit;
}
if ($reporterEmail !== '' && (!filter_var($reporterEmail, FILTER_VALIDATE_EMAIL) || mb_strlen($reporterEmail) > 190)) {
    http_response_code(400);
    echo json_encode(['error' => 'A valid email address (max 190 characters) is required.']);
    exit;
}

$validCategories = ['Waste', 'Water', 'Road & Infrastructure', 'Electrical', 'Public Safety', 'Document Request'];
try {
  $settingsStmt = $pdo->query("SELECT `value` FROM system_settings WHERE `key` = 'categories' LIMIT 1");
  $rawCats = $settingsStmt ? $settingsStmt->fetchColumn() : false;
  if ($rawCats) {
    $configured = json_decode($rawCats, true);
    if (is_array($configured) && $configured) {
      $validCategories = array_unique(array_merge($validCategories, $configured));
    }
  }
} catch (PDOException $e) {
  // fall back to legacy list
}
// Include frontend ResidentReportPage categories so resident submissions are accepted
$frontendCats = ['Road / Street','Street Light','Water Problem','Drainage / Flooding','Garbage / Waste','Public Safety','Noise Complaint','Environment','Other'];
$validCategories = array_unique(array_merge($validCategories, $frontendCats));
if (!in_array($category, $validCategories, true) && mb_strlen($category) > 100) {
  http_response_code(400);
  echo json_encode(['error' => 'Invalid category.']);
  exit;
}
if (trim($category) === '' || mb_strlen($category) > 100) {
  http_response_code(400);
  echo json_encode(['error' => 'Invalid category.']);
  exit;
}

$headers = getallheaders();
$token = $headers['Authorization'] ?? $headers['authorization'] ?? '';

if (empty($token)) {
    http_response_code(401);
    echo json_encode(['error' => 'Unauthorized. No token provided.']);
    exit;
}

$isAuth = preg_match('/^Bearer\s+(.+)$/i', $token, $matches);
$reporterUserId = null;
if ($isAuth) {
  $payload = token_payload();
  if ($payload && isset($payload['user_id'])) {
    $reporterUserId = (int)$payload['user_id'];
  }
  $maxRequests = 10; // authenticated residents
} else {
    http_response_code(401);
    echo json_encode(['error' => 'Unauthorized. Authentication required to submit a report.']);
    exit;
}

require_once __DIR__ . '/../middleware/write_ratelimit.php';
xevera_write_rate_limit($pdo, 'reports.create', 10, 3600);

$photoPaths = [];
if (!empty($_FILES['photos'])) {
    $files = $_FILES['photos'];
    $uploadDir = __DIR__ . '/../../uploads/';

    if (!is_dir($uploadDir)) {
        mkdir($uploadDir, 0755, true);
    }

    $fileCount = is_array($files['name']) ? count($files['name']) : 1;
    for ($i = 0; $i < $fileCount; $i++) {
        $fName = is_array($files['name']) ? $files['name'][$i] : $files['name'];
        $fTmp = is_array($files['tmp_name']) ? $files['tmp_name'][$i] : $files['tmp_name'];
        $fError = is_array($files['error']) ? $files['error'][$i] : $files['error'];

        if ($fError !== UPLOAD_ERR_OK) continue;

        $fFile = [
            'name'     => $fName,
            'tmp_name' => $fTmp,
            'error'    => $fError,
            'size'     => is_array($files['size']) ? $files['size'][$i] : $files['size'],
        ];
        $validated = xevera_validate_image_upload($fFile);
        $ext = $validated['ext'];

        $newName = uniqid('photo_') . '.' . $ext;
        move_uploaded_file($fTmp, $uploadDir . $newName);
        $photoPaths[] = 'uploads/' . $newName;
    }
}

$refId = null;
$year = date('Y');
$stmt = $pdo->prepare("SELECT COUNT(*) FROM reports WHERE ref_id LIKE ?");
$stmt->execute([$year . '-%']);
$yearCount = (int)$stmt->fetchColumn();
for ($i = 0; $i < 100; $i++) {
  $candidate = 'XR-' . $year . '-' . str_pad(1000 + $yearCount + $i, 6, '0', STR_PAD_LEFT);
  $dup = $pdo->prepare('SELECT COUNT(*) FROM reports WHERE ref_id = ?');
  $dup->execute([$candidate]);
  if ((int)$dup->fetchColumn() === 0) {
    $refId = $candidate;
    break;
  }
}
if ($refId === null) {
  $refId = 'XR-' . date('Y') . '-' . strtoupper(substr(bin2hex(random_bytes(4)), 0, 6));
}

$stmt = $pdo->prepare('
    INSERT INTO reports (ref_id, title, category, description, location, status, reporter_user_id, reporter_name, reporter_phone, reporter_email, photo_paths)
    VALUES (?, ?, ?, ?, ?, \'Pending\', ?, ?, ?, ?, ?)
');
$stmt->execute([
    $refId,
    $title,
    $category,
    $description,
    $location,
    $reporterUserId,
    $reporterName,
    $reporterPhone,
    $reporterEmail,
    json_encode($photoPaths),
]);

$logStmt = $pdo->prepare('INSERT INTO activity_logs (user_id, action, target_type, target_id, detail) VALUES (?, ?, ?, ?, ?)');
$logStmt->execute([null, 'create_report', 'report', $pdo->lastInsertId(), 'Report submitted: ' . $refId . ' - ' . $title]);

echo json_encode([
    'message' => 'Report submitted successfully.',
    'ref_id' => $refId,
]);
