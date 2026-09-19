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
/* Limits match the reports table columns exactly. */
if (mb_strlen($reporterName) > 100 || mb_strlen($reporterPhone) > 20) {
    http_response_code(400);
    echo json_encode(['error' => 'Reporter name (max 100) or phone (max 20) is too long.']);
    exit;
}
if ($reporterEmail !== '' && (!filter_var($reporterEmail, FILTER_VALIDATE_EMAIL) || mb_strlen($reporterEmail) > 100)) {
    http_response_code(400);
    echo json_encode(['error' => 'A valid email address (max 100 characters) is required.']);
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

/*
 * PUBLIC (GUEST) REPORTING
 *
 * Reporting does not require an account - the public UI states
 * "no account required", so an anonymous visitor must be able to submit.
 * When a valid Bearer token is present the report is linked to that
 * resident's account; otherwise it is stored as a guest submission.
 * Abuse is contained by the per-IP write rate limit below plus the fact
 * that every new report enters the moderation queue as "Pending".
 */
$headers = getallheaders();
$token = $headers['Authorization'] ?? $headers['authorization'] ?? '';

$reporterUserId = null;
if (!empty($token) && preg_match('/^Bearer\s+(.+)$/i', $token)) {
  $payload = token_payload();
  if ($payload && isset($payload['user_id'])) {
    $reporterUserId = (int)$payload['user_id'];
  }
}

/*
 * Guest submissions must supply a contact email so staff can follow up.
 * (Logged-in residents already carry this from their profile.)
 */
if ($reporterUserId === null && $reporterEmail === '') {
  http_response_code(400);
  echo json_encode(['error' => 'Please provide your email address so we can follow up on your report.']);
  exit;
}

require_once __DIR__ . '/../middleware/write_ratelimit.php';
xevera_write_rate_limit($pdo, 'reports.create', 5, 3600);

/* ── Fake report detection: capture IP ── */
$clientIp = $_SERVER['HTTP_X_FORWARDED_FOR'] ?? $_SERVER['HTTP_X_REAL_IP'] ?? $_SERVER['REMOTE_ADDR'] ?? 'unknown';
if (strpos($clientIp, ',') !== false) {
    $clientIp = trim(explode(',', $clientIp)[0]);
}

/* ── Suspicion checks ── */
$isSuspicious = false;
$suspicionReason = null;

// 1. Very short description
if (mb_strlen($description) < 10) {
    $isSuspicious = true;
    $suspicionReason = 'Very short description';
}

// 2. Duplicate report: same description from same user/IP in 24 hours
if (!$isSuspicious) {
    $dupStmt = $pdo->prepare('SELECT COUNT(*) FROM reports WHERE description = ? AND (reporter_user_id <=> ? OR ip_address = ?) AND created_at > DATE_SUB(NOW(), INTERVAL 24 HOUR)');
    $dupStmt->execute([$description, $reporterUserId, $clientIp]);
    if ((int)$dupStmt->fetchColumn() > 0) {
        $isSuspicious = true;
        $suspicionReason = 'Duplicate report detected';
    }
}

// 3. Rapid submissions: 3+ reports from same user/IP within 1 hour
if (!$isSuspicious) {
    $rapidStmt = $pdo->prepare('SELECT COUNT(*) FROM reports WHERE (reporter_user_id <=> ? OR ip_address = ?) AND created_at > DATE_SUB(NOW(), INTERVAL 1 HOUR)');
    $rapidStmt->execute([$reporterUserId, $clientIp]);
    if ((int)$rapidStmt->fetchColumn() >= 3) {
        $isSuspicious = true;
        $suspicionReason = 'Rapid submissions';
    }
}

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
    INSERT INTO reports (ref_id, title, category, description, location, status, reporter_user_id, reporter_name, reporter_phone, reporter_email, photo_paths, is_suspicious, suspicion_reason, ip_address)
    VALUES (?, ?, ?, ?, ?, \'Pending\', ?, ?, ?, ?, ?, ?, ?, ?)
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
    $isSuspicious ? 1 : 0,
    $suspicionReason,
    $clientIp,
]);

$logStmt = $pdo->prepare('INSERT INTO activity_logs (user_id, action, target_type, target_id, detail) VALUES (?, ?, ?, ?, ?)');
$logStmt->execute([null, 'create_report', 'report', $pdo->lastInsertId(), 'Report submitted: ' . $refId . ' - ' . $title]);

echo json_encode([
    'message' => 'Report submitted successfully.',
    'ref_id' => $refId,
    'is_suspicious' => $isSuspicious ? 1 : 0,
    'suspicion_reason' => $suspicionReason,
]);
